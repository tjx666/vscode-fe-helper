/* eslint-disable unicorn/better-regex, prefer-template */
import vscode, { TextEditor, TextEditorEdit, TextDocument, Range, Position } from 'vscode';
import * as recast from 'recast';
import postcss, { Result as PostcssProcessResult } from 'postcss';
import scssSyntax from 'postcss-scss';
import lessSyntax from 'postcss-less';
import * as jsonc from 'jsonc-parser';

import { parseSourceToAst } from '../ast';
import postcssDiscardComments from './postcssDiscardComments';
import { replaceAllTextOfEditor } from '../utils';

export default class RemoveComments {
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

    public handler(): void {
        const { languageId } = this;
        if (RemoveComments.supportedScriptLangs.has(languageId)) {
            this.removeScriptLangComments();
        } else if (RemoveComments.supportedStyleLangs.has(languageId)) {
            this.removeStyleLangComments();
        } else if (languageId === 'jsonc') {
            this.removeJSONCComments();
        } else if (languageId === 'vue') {
            this.removeVueComments();
        }
    }

    private removeScriptLangComments(): void {
        const { editBuilder, source, languageId } = this;

        let ast: any;
        try {
            ast = parseSourceToAst(source);
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`Your ${languageId} code exists syntax error!`);
            return;
        }
        recast.visit(ast, {
            visitComment(path) {
                // !: path.node can't access right location
                const { start, end } = path.value.loc as any;
                const startPosition = new Position(start.line - 1, start.column);
                const endPosition = new Position(end.line - 1, end.column);
                editBuilder.delete(new Range(startPosition, endPosition));
                return false;
            },
        });
    }

    private async removeStyleLangComments(): Promise<void> {
        const { editor, source, languageId } = this;

        let result: PostcssProcessResult;
        try {
            result = await postcss([postcssDiscardComments]).process(source, {
                syntax: RemoveComments.supportedStyleLangs.get(languageId),
                from: undefined,
            });
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`Your ${languageId} code exists syntax error!`);
            return;
        }
        await replaceAllTextOfEditor(editor, result.content);
    }

    private async removeJSONCComments() {
        const { editBuilder, document, source } = this;

        try {
            jsonc.visit(source, {
                onComment(offset: number, length: number) {
                    const startPosition = document.positionAt(offset);
                    const endPosition = document.positionAt(offset + length);
                    editBuilder.delete(new Range(startPosition, endPosition));
                },
            });
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`Your jsonc code exists syntax error!`);
        }
    }

    private async removeVueComments() {
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
            let ast: any;
            try {
                ast = parseSourceToAst(scriptString);
            } catch (error) {
                console.error(error);
                vscode.window.showErrorMessage(`Your script code exists syntax error!`);
                return;
            }
            recast.visit(ast, {
                visitComment(path) {
                    path.prune();
                    return false;
                },
            });
            source =
                source.slice(0, scriptMatch.index) +
                `<script>${recast.print(ast).code}</script>` +
                source.slice(scriptMatch.index + scriptMatch[0].length);
        }

        const styleRE = /<style([^>]*)>((\n|\r|.)*)<\/style>/m;
        const styleMatch = source.match(styleRE);
        if (styleMatch && styleMatch.index != null) {
            const styleString = styleMatch[2];
            const langMatch = styleMatch[1].match(/lang=['"](\w+)['"]/m);
            const lang = langMatch ? langMatch[1].trim() : 'css';
            let result: PostcssProcessResult;
            try {
                // eslint-disable-next-line no-await-in-loop
                result = await postcss([postcssDiscardComments]).process(styleString, {
                    syntax: RemoveComments.supportedStyleLangs.get(lang),
                    from: undefined,
                });
            } catch (error) {
                console.error(error);
                vscode.window.showErrorMessage(`Your ${lang} code exists syntax error!`);
                return;
            }
            source =
                source.slice(0, styleMatch.index) +
                `<style${styleMatch[1]}>${result.content}</style>` +
                source.slice(styleMatch.index + styleMatch[0].length);
        }

        await replaceAllTextOfEditor(editor, source);
    }
}
