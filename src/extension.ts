import vscode, { TextEditor, TextEditorEdit } from 'vscode';

import RemoveComments from './removeComments';
import TransformModule from './transformModule';

export function activate(context: vscode.ExtensionContext): void {
    const removeCommentsCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.removeComments',
        (textEditor: TextEditor, editBuilder: TextEditorEdit) =>
            new RemoveComments(textEditor, editBuilder).handle(),
    );
    const transformModuleCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.transformModule',
        (textEditor: TextEditor) => new TransformModule(textEditor).handle(),
    );

    context.subscriptions.push(removeCommentsCmd, transformModuleCmd);
}

export function deactivate(): void {
    // recycle resource...
}
