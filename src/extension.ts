import vscode, { TextEditor, TextEditorEdit } from 'vscode';

import RemoveComments from './removeComments';
import TransformModule from './transformModuleImports';
import pluralize from './pluralize';
import removeIrregularWhitespace from './removeIrregularWhitespace';
import transformColorFormat from './transformColorFormat';
import jsonToCode from './jsonToCode';

import { log } from './utils/log';
import { EXTENSION_ID } from './utils/constants';

export function activate(context: vscode.ExtensionContext): void {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    const version = extension?.packageJSON?.version ?? '-';
    log(`${EXTENSION_ID}(V.${version}) now active! : ${context.extensionPath}`);

    const removeCommentsCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.removeComments',
        (textEditor: TextEditor, editBuilder: TextEditorEdit) =>
            new RemoveComments(textEditor, editBuilder).handle(),
    );

    const transformModuleImportsCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.transformModuleImports',
        (textEditor: TextEditor) => new TransformModule(textEditor).handle(),
    );

    const pluralizeCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.pluralize',
        pluralize,
    );

    const removeIrregularWhitespaceCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.removeIrregularWhitespace',
        removeIrregularWhitespace,
    );

    const transformColorFormatCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.transformColorFormat',
        transformColorFormat,
    );

    const jsonToCodeCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.jsonToCode',
        jsonToCode,
    );

    context.subscriptions.push(
        removeCommentsCmd,
        transformModuleImportsCmd,
        pluralizeCmd,
        removeIrregularWhitespaceCmd,
        transformColorFormatCmd,
        jsonToCodeCmd,
    );
}

export function deactivate(): void {
    // recycle resource...
}
