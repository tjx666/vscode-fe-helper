import * as vscode from 'vscode';

import removeComments from './removeComments';

export function activate(context: vscode.ExtensionContext) {
    const removeCommentsCmd = vscode.commands.registerCommand(
        'VSCodeFEHelper.removeComments',
        removeComments,
    );
    context.subscriptions.push(removeCommentsCmd);
}

export function deactivate() {
    // recycle resource...
}
