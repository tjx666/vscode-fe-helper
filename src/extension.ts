import vscode, { TextEditor, TextEditorEdit } from 'vscode';

import copyTextWithoutSyntax from './copyTextWithoutSyntax';
import copyWithLineNumber from './copyWIthLineNumber';
import jsonToCode from './jsonToCode';
import pluralize from './pluralize';
import RemoveComments from './removeComments';
import removeIrregularWhitespace from './removeIrregularWhitespace';
import spaceGod from './spaceGod';
import transformColorFormat from './transformColorFormat';
import TransformModule from './transformModuleImports';
import { EXTENSION_ID } from './utils/constants';
import { log } from './utils/log';

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
        removeCommentsCmd,
        transformModuleImportsCmd,
        pluralizeCmd,
        removeIrregularWhitespaceCmd,
        transformColorFormatCmd,
        jsonToCodeCmd,
        spaceGodCmd,
        copyWithLineNumberCmd,
        copyTextWithoutSyntaxCmd,
    );
}

export function deactivate(): void {
    // recycle resource...
}
