import vscode, { TextEditor, TextEditorEdit } from 'vscode';

import RemoveComments from './removeComments';
import TransformModule from './transformModuleImports';
import pluralize from './pluralize';

import { log } from './utils/log';
import { EXTENSION_ID } from './utils/constants';

export function activate(context: vscode.ExtensionContext): void {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    const version = extension?.packageJSON?.version ?? '-';
    log(`${EXTENSION_ID} ver.${version} now active! : ${context.extensionPath}`);

    const removeCommentsCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.removeComments',
        (textEditor: TextEditor, editBuilder: TextEditorEdit) =>
            new RemoveComments(textEditor, editBuilder).handle(),
    );

    const transformModuleCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.transformModuleImports',
        (textEditor: TextEditor) => new TransformModule(textEditor).handle(),
    );

    const pluralizeCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.pluralize',
        pluralize,
    );

    context.subscriptions.push(removeCommentsCmd, transformModuleCmd, pluralizeCmd);
}

export function deactivate(): void {
    // recycle resource...
}
