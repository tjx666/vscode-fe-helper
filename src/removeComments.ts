import vscode from 'vscode';
// FIXME: can't use default import
import * as recast from 'recast';

import { parseSourceToAst } from './ast';
import { replaceAllTextOfEditor } from './utils';

/** remove the comments node in ast */
function transform(ast: any): void {
    recast.visit(ast, {
        visitComment(path) {
            path.prune();
            return false;
        },
    });
}

export default async function removeComments(): Promise<void> {
    const supportLanguages = new Set(['javascript', 'typescript']);
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
        const editorDocument = activeEditor.document;
        if (supportLanguages.has(editorDocument.languageId)) {
            const editorContent = editorDocument.getText();
            const ast = parseSourceToAst(editorContent);
            transform(ast);
            const commentsRemovedCode = recast.print(ast).code;
            replaceAllTextOfEditor(activeEditor, commentsRemovedCode);
        }
    }
}
