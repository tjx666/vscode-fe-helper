import vscode, {
    TextEditor,
    TextEditorEdit,
} from 'vscode';

import copyTextWithoutSyntax from './copyTextWithoutSyntax';
import copyWithLineNumber from './copyWithLineNumber';
import jsonToObject from './jsonToObject';
import pluralize from './pluralize';
import removeIrregularWhitespace from './removeIrregularWhitespace';
import smartCopy from './smartCopy';
import spaceGod from './spaceGod';
import transformColorFormat from './transformColorFormat';
import { EXTENSION_ID } from './utils/constants';
import {
    log,
    outputPanelLogger,
} from './utils/log';

export function activate(context: vscode.ExtensionContext): void {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    const version = extension?.packageJSON?.version ?? '-';
    log(`${EXTENSION_ID}(V.${version}) now active! : ${context.extensionPath}`);

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.removeComments',
            (textEditor: TextEditor, editBuilder: TextEditorEdit) =>
                import('./removeComments').then(({ default: RemoveComments }) =>
                    new RemoveComments(textEditor, editBuilder).handle(),
                ),
        ),
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.transformESSyntax',
            (textEditor: TextEditor) =>
                import('./transformESSyntax').then(({ default: transformESSyntax }) =>
                    transformESSyntax(textEditor),
                ),
        ),
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.transformModuleImports',
            (textEditor: TextEditor) =>
                import('./transformModuleImports').then(({ default: TransformModule }) =>
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
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.copyWithLineNumber',
            copyWithLineNumber,
        ),
        vscode.commands.registerTextEditorCommand(
            'VSCodeFEHelper.copyTextWithoutSyntax',
            copyTextWithoutSyntax,
        ),
        vscode.commands.registerTextEditorCommand('VSCodeFEHelper.smartCopy', smartCopy),
    );
}

export function deactivate(): void {
    outputPanelLogger.dispose();
}
