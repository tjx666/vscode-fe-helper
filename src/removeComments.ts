import vscode from 'vscode';
// FIXME: can't use default import
import * as recast from 'recast';
import fs from 'fs-extra';

import { parseSourceToAst } from './ast';

export default async function removeComments() {
    const supportLanguages = new Set(['javascript', 'typescript']);
    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
        const languageId = activeEditor.document.languageId;
        if (supportLanguages.has(languageId)) {
            const editorContent = activeEditor.document.getText();
            const ast = parseSourceToAst(editorContent);
            transform(ast);
            const commentsRemovedCode = recast.print(ast).code;
            const editorFilePath = activeEditor.document.uri.fsPath;
            await fs.writeFile(editorFilePath, commentsRemovedCode);
        }
    }
}

/** remove the comments node in ast */
function transform(ast: any) {
    recast.visit(ast, {
        visitComment(path) {
            path.prune();
            return false;
        },
    });
}
