/* eslint-disable unicorn/better-regex, prefer-template */
import { ASTNode } from 'ast-types';
import jsonc from 'jsonc-parser';
import postcss, { Result as PostcssProcessResult } from 'postcss';
import lessSyntax from 'postcss-less';
import scssSyntax from 'postcss-scss';
// !: 使用默认导入编译不报错，运行时报错
import * as recast from 'recast';
import vscode, {
    Range,
    TextDocument,
    TextEditor,
    TextEditorEdit,
} from 'vscode';

import { parseSourceToAst } from '../utils/ast';
import { ID_LANG_MAPPER } from '../utils/constants';
import { replaceAllTextOfEditor } from '../utils/editor';
import postcssDiscardComments from './postcssDiscardComments';

export class RemoveComments {
    private static readonly supportedMarkLangs = new Set(['html', 'xml', 'markdown']);
    private static readonly supportedScriptLangs = new Set([
        'javascript',
        'typescript',
        'javascriptreact',
        'typescriptreact',
    ]);
    private static readonly supportedStyleLangs = new Map([
        ['css', undefined],
        ['scss', scssSyntax],
        ['less', lessSyntax],
    ]);
    private static readonly supportedYamlCommentsLikeLangs = new Set(['yaml', 'editorconfig']);

    private readonly editor: TextEditor;
    private readonly editBuilder: TextEditorEdit;
    private readonly document: TextDocument;
    private readonly languageId: string;
    private readonly source: string;

    constructor(editor: TextEditor, editBuilder: TextEditorEdit) {
        this.editor = editor;
        this.editBuilder = editBuilder;
        this.document = editor.document;
        this.languageId = editor.document.languageId;
        this.source = editor.document.getText();
    }

    public async handle(): Promise<any> {
        const { languageId } = this;
        if (RemoveComments.supportedMarkLangs.has(languageId)) {
            this.removeMarkLanguageComments();
        } else if (RemoveComments.supportedStyleLangs.has(languageId)) {
            await this.removeStyleComments();
        } else if (RemoveComments.supportedScriptLangs.has(languageId)) {
            await this.removeScriptComments();
            // eslint-disable-next-line unicorn/prefer-switch
        } else if (languageId === 'jsonc') {
            await this.removeJSONCComments();
        } else if (languageId === 'vue') {
            await this.removeVueComments();
        } else if (languageId === 'ignore') {
            this.removeIgnoreComments();
        } else if (RemoveComments.supportedYamlCommentsLikeLangs.has(languageId)) {
            this.removeYamlComments();
        } else {
            return;
        }

        // eslint-disable-next-line consistent-return
        return vscode.commands.executeCommand('editor.action.formatDocument');
    }

    private removeCommentsMatchRegexp(commentRegexp: RegExp): void {
        const { editor, document, source } = this;
        let execResult: RegExpExecArray | null;
        editor.edit((editBuilder) => {
            while ((execResult = commentRegexp.exec(source))) {
                editBuilder.replace(
                    new Range(
                        document.positionAt(execResult.index),
                        document.positionAt(execResult.index + execResult[0].length),
                    ),
                    '',
                );
            }
        });
    }

    private removeMarkLanguageComments(): void {
        const templateCommentRE = /<!--(\n|\r|.)*?-->/gm;
        this.removeCommentsMatchRegexp(templateCommentRE);
    }

    private static async getCommentsRemovedStyleCode(
        source: string,
        languageId: string,
    ): Promise<string> {
        let result: PostcssProcessResult;
        try {
            result = await postcss([postcssDiscardComments]).process(source, {
                syntax: RemoveComments.supportedStyleLangs.get(languageId),
                from: undefined,
            });
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(
                `Your ${ID_LANG_MAPPER.get(languageId)} code exists syntax error!`,
            );
            return '';
        }
        return result.content;
    }

    private static async getCommentsRemovedScriptCode(source: string) {
        let ast: ASTNode;
        try {
            ast = await parseSourceToAst(source);
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`Your script code exists syntax error!`);
            return '';
        }
        recast.visit(ast, {
            visitComment(path) {
                path.prune();
                return false;
            },
        });

        return recast.print(ast).code;
    }

    private async removeStyleComments(): Promise<void> {
        const { editor, source, languageId } = this;
        await replaceAllTextOfEditor(
            editor,
            await RemoveComments.getCommentsRemovedStyleCode(source, languageId),
        );
    }

    private async removeScriptComments(): Promise<void> {
        const { editor, document } = this;
        await replaceAllTextOfEditor(
            editor,
            await RemoveComments.getCommentsRemovedScriptCode(document.getText()),
        );
    }

    private async removeJSONCComments(): Promise<void> {
        const { editor, document, source } = this;

        try {
            editor.edit((editBuilder) => {
                jsonc.visit(source, {
                    onComment(offset: number, length: number) {
                        editBuilder.delete(
                            new Range(
                                document.positionAt(offset),
                                document.positionAt(offset + length),
                            ),
                        );
                    },
                });
            });
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`Your jsonc code exists syntax error!`);
        }
    }

    private async removeVueComments(): Promise<void> {
        const { editor, document } = this;

        let source = document.getText();
        const templateRE = /<template>(\n|\r|.)*<\/template>/m;
        const templateMatch = source.match(templateRE);
        if (templateMatch && templateMatch.index != null) {
            const templateString = templateMatch[0];
            const templateCommentRE = /<!--(\n|\r|.)*?-->/gm;
            source =
                source.slice(0, templateMatch.index) +
                templateString.replace(templateCommentRE, '') +
                source.slice(templateMatch.index + templateString.length);
        }

        const scriptRE = /<script>((\n|\r|.)*)<\/script>/m;
        const scriptMatch = source.match(scriptRE);
        if (scriptMatch && scriptMatch.index != null) {
            const scriptString = scriptMatch[1];
            source =
                source.slice(0, scriptMatch.index) +
                `<script>${RemoveComments.getCommentsRemovedScriptCode(scriptString)}</script>` +
                source.slice(scriptMatch.index + scriptMatch[0].length);
        }

        const styleRE = /<style([^>]*)>((\n|\r|.)*)<\/style>/m;
        const styleMatch = source.match(styleRE);
        if (styleMatch && styleMatch.index != null) {
            const styleString = styleMatch[2];
            const langMatch = styleMatch[1].match(/lang=['"](\w+)['"]/m);
            const lang = langMatch ? langMatch[1].trim() : 'css';
            const commentsRemovedStyleCode = await RemoveComments.getCommentsRemovedStyleCode(
                styleString,
                lang,
            );
            source =
                source.slice(0, styleMatch.index) +
                `<style${styleMatch[1]}>${commentsRemovedStyleCode}</style>` +
                source.slice(styleMatch.index + styleMatch[0].length);
        }

        await replaceAllTextOfEditor(editor, source);
    }

    private removeIgnoreComments(): void {
        const commentRE = /^#.*/gm;
        this.removeCommentsMatchRegexp(commentRE);
    }

    private removeYamlComments(): void {
        const commentRE = /\s*#.*/gm;
        this.removeCommentsMatchRegexp(commentRE);
    }
}
