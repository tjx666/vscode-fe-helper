import type { TextEditor, TextEditorEdit } from 'vscode';
import vscode from 'vscode';

import jsonToObject from './jsonToObject';
import pluralize from './pluralize';
import removeIrregularWhitespace from './removeIrregularWhitespace';
import spaceGod from './spaceGod';
import transformColorFormat from './transformColorFormat';
import { EXTENSION_ID } from './utils/constants';
import { log, outputPanelLogger } from './utils/log';

export function activate(context: vscode.ExtensionContext): void {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    const version = extension?.packageJSON?.version ?? '-';
    log(`${EXTENSION_ID}(V.${version}) now active! : ${context.extensionPath}`);

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.removeComments',
            (textEditor: TextEditor, editBuilder: TextEditorEdit) =>
                import('./removeComments').then(({ RemoveComments }) =>
                    new RemoveComments(textEditor, editBuilder).handle(),
                ),
        ),
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.transformESSyntax',
            (textEditor: TextEditor) =>
                import('./transformESSyntax').then(({ transformESSyntax }) =>
                    transformESSyntax(textEditor),
                ),
        ),
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.transformModuleImports',
            (textEditor: TextEditor) =>
                import('./transformModuleImports').then(({ TransformModule }) =>
                    new TransformModule(textEditor).handle(),
                ),
        ),
        vscode.commands.registerTextEditorCommand('VSCodeFEHelper.pluralize', pluralize),
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.removeIrregularWhitespace',
            removeIrregularWhitespace,
        ),
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.transformColorFormat',
            transformColorFormat,
        ),
        vscode.commands.registerTextEditorCommand('VSCodeFEHelper.jsonToObject', jsonToObject),
        vscode.commands.registerTextEditorCommand('VSCodeFEHelper.spaceGod', spaceGod),
    );
}

export function deactivate(): void {
    outputPanelLogger.dispose();
}
