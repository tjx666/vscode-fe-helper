import vscode, { TextEditor, TextEditorEdit } from 'vscode';

import RemoveComments from './removeComments';

export function activate(context: vscode.ExtensionContext) {
    const removeCommentsCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.removeComments',
        (textEditor: TextEditor, editBuilder: TextEditorEdit) => {
            const removeComments = new RemoveComments(textEditor, editBuilder);
            removeComments.handler();
        },
    );
    context.subscriptions.push(removeCommentsCmd);
}

export function deactivate() {
    // recycle resource...
}
