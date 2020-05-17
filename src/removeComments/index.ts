import vscode, { TextEditor, Position, Range, TextEditorEdit, TextDocument } from 'vscode';
// FIXME: can't use default import
import * as recast from 'recast';
import postcss, { Result as ProcessResult } from 'postcss';
import scssSyntax from 'postcss-scss';
import lessSyntax from 'postcss-less';
import * as JSONC from 'jsonc-parser';

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
            this.removeScriptLanguageComments();
        } else if (RemoveComments.supportedStyleLangs.has(languageId)) {
            this.removeStyleLanguageComments();
        } else if (languageId === 'jsonc') {
            this.removeJSONCComments();
        }
    }

    private removeScriptLanguageComments(): void {
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
                const commentLocation = path.value.loc as typeof path.node.loc;
                if (commentLocation) {
                    const startPosition = new Position(
                        commentLocation.start.line - 1,
                        commentLocation.start.column,
                    );
                    const endPosition = new Position(
                        commentLocation.end.line - 1,
                        commentLocation.end.column,
                    );
                    editBuilder.delete(new Range(startPosition, endPosition));
                }
                return false;
            },
        });
    }

    private async removeStyleLanguageComments() {
        const { editor, source, languageId } = this;
        let result: ProcessResult;
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
            JSONC.visit(source, {
                onComment(offset: number, length: number) {
                    const startPosition = document.positionAt(offset);
                    const endPosition = document.positionAt(offset + length);
                    editBuilder.delete(new Range(startPosition, endPosition));
                },
            });
        } catch (error) {
            console.error(error);
            vscode.window.showErrorMessage(`Your JSONC code exists syntax error!`);
        }
    }
}
