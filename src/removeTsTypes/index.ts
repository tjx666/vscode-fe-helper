import tsBlankSpace from 'ts-blank-space';
import type { Range, TextEditor } from 'vscode';
import vscode from 'vscode';

import { getWholeDocumentRange } from '../utils/editor';

export async function removeTsTypes(editor: TextEditor) {
    const { document, selection } = editor;

    let range: Range = selection;
    // no selection will transform whole editor
    if (document.getText(selection).length === 0) {
        range = getWholeDocumentRange(document);
    }

    const tsSourceCode = document.getText(range);
    const jsCode = tsBlankSpace(tsSourceCode);

    await editor.edit((editBuilder) => {
        editBuilder.replace(range, jsCode);
    });

    // 触发编辑器格式化
    await vscode.commands.executeCommand('editor.action.formatDocument');
}
