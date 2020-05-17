import vscode, { TextEditor, Position, Range } from 'vscode';
// FIXME: can't use default import
import * as recast from 'recast';
import postcss, { Result as ProcessResult } from 'postcss';
import scssSyntax from 'postcss-scss';
import lessSyntax from 'postcss-less';

import { parseSourceToAst } from './ast';
import postcssDiscardComments from './postcssDiscardComments';
import { replaceAllTextOfEditor } from './utils';

const supportedScriptLanguages = new Set([
    'javascript',
    'typescript',
    'javascriptreact',
    'typescriptreact',
]);
const supportedStyleLanguage = new Map([
    ['css', undefined],
    ['scss', scssSyntax],
    ['less', lessSyntax],
]);

export default function removeComments(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const source = activeEditor.document.getText();
        const language = activeEditor.document.languageId;
        if (supportedScriptLanguages.has(language)) {
            removeScriptLanguageComments(activeEditor, source);
        } else if (supportedStyleLanguage.has(language)) {
            removeStyleLanguageComments(activeEditor, source);
        }
    }
}

/**
 * remove comment from script language
 *
 * @param editor
 * @param source
 */
function removeScriptLanguageComments(editor: TextEditor, source: string) {
    let ast: any;
    try {
        ast = parseSourceToAst(source);
    } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage(
            `Your ${editor.document.languageId} code exists syntax error!`,
        );
        return;
    }
    editor.edit((editBuilder) => {
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
    });
}

/**
 * remove comments from style file using postcss
 *
 * @param editor
 * @param source
 */
async function removeStyleLanguageComments(editor: TextEditor, source: string) {
    const { languageId } = editor.document;
    let result: ProcessResult;
    try {
        result = await postcss([postcssDiscardComments]).process(source, {
            syntax: supportedStyleLanguage.get(languageId),
            from: undefined,
        });
    } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage(`Your ${languageId} code exists syntax error!`);
        return;
    }
    await replaceAllTextOfEditor(editor, result.content);
}
