import vscode, { TextEditor, TextEditorEdit } from 'vscode';

import copyTextWithoutSyntax from './copyTextWithoutSyntax';
import copyWithLineNumber from './copyWithLineNumber';
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

    import('./removeComments').then(({ default: RemoveComments }) => {
        context.subscriptions.push(
            vscode.commands.registerTextEditorCommand(
                'VSCodeFEHelper.removeComments',
                (textEditor: TextEditor, editBuilder: TextEditorEdit) =>
                    new RemoveComments(textEditor, editBuilder).handle(),
            ),
        );
    });

    import('./transformESSyntax').then(({ default: transformESSyntax }) => {
        context.subscriptions.push(
            vscode.commands.registerTextEditorCommand(
                'VSCodeFEHelper.transformESSyntax',
                transformESSyntax,
            ),
        );
    });

    import('./transformModuleImports').then(({ default: TransformModule }) => {
        context.subscriptions.push(
            vscode.commands.registerTextEditorCommand(
                'VSCodeFEHelper.transformModuleImports',
                (textEditor: TextEditor) => new TransformModule(textEditor).handle(),
            ),
        );
    });

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

    const jsonToObjectCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.jsonToObject',
        jsonToObject,
    );

    const spaceGodCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.spaceGod',
        spaceGod,
    );

    const copyWithLineNumberCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.copyWithLineNumber',
        copyWithLineNumber,
    );

    const copyTextWithoutSyntaxCmd = vscode.commands.registerTextEditorCommand(
        'VSCodeFEHelper.copyTextWithoutSyntax',
        copyTextWithoutSyntax,
    );

    context.subscriptions.push(
        pluralizeCmd,
        removeIrregularWhitespaceCmd,
        transformColorFormatCmd,
        jsonToObjectCmd,
        spaceGodCmd,
        copyWithLineNumberCmd,
        copyTextWithoutSyntaxCmd,
    );
}

export function deactivate(): void {
    outputPanelLogger.dispose();
}
