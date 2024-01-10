import fs from 'node:fs/promises';

import type { TextEditor, TextEditorEdit } from 'vscode';
import vscode from 'vscode';

import { jsUnicodePreview } from './jsUnicodePreview';
import { pathExists } from './utils/fs';
import { logger, shellLogger } from './utils/log';
import { store } from './utils/store';

export async function activate(context: vscode.ExtensionContext) {
    const { commands } = vscode;
    const extName = 'VSCodeFEHelper';

    const storageDir = context.storageUri!.fsPath;
    store.storageDir = storageDir;
    if (!(await pathExists(storageDir))) {
        await fs.mkdir(storageDir);
    }

    jsUnicodePreview(context);

    const registerCommand = (
        commandName: string,
        callback: (...args: any[]) => any,
        thisArg?: any,
    ) => {
        const cmd = commands.registerCommand(`${extName}.${commandName}`, callback, thisArg);
        context.subscriptions.push(cmd);
        return cmd;
    };

    const registerTextEditorCommand = (
        commandName: string,
        callback: (
            textEditor: vscode.TextEditor,
            edit: vscode.TextEditorEdit,
            ...args: any[]
        ) => void,
        thisArg?: any,
    ) => {
        const cmd = commands.registerTextEditorCommand(
            `${extName}.${commandName}`,
            callback,
            thisArg,
        );
        context.subscriptions.push(cmd);
        return cmd;
    };

    // jsUnicodePreview(context);

    registerTextEditorCommand(
        'removeComments',
        async (editor: TextEditor, editBuilder: TextEditorEdit) => {
            const { RemoveComments } = await import('./removeComments');
            return new RemoveComments(editor, editBuilder).handle();
        },
    );

    registerTextEditorCommand('transformESSyntax', (editor: TextEditor) =>
        import('./transformESSyntax').then((mod) => mod.transformESSyntax(editor)),
    );

    registerTextEditorCommand('removeTsTypes', (editor: TextEditor) =>
        import('./removeTsTypes').then((mod) => mod.removeTsTypes(editor)),
    );

    registerTextEditorCommand('pluralize', (editor: TextEditor) =>
        import('./pluralize').then((mod) => mod.plur(editor)),
    );

    registerTextEditorCommand(
        'removeIrregularWhitespace',
        (editor: TextEditor, editBuilder: TextEditorEdit) =>
            import('./removeIrregularWhitespace').then((mod) =>
                mod.removeIrregularWhitespace(editor, editBuilder),
            ),
    );

    registerTextEditorCommand('transformColorFormat', (editor: TextEditor) =>
        import('./transformColorFormat').then((mod) => mod.transformColorFormat(editor)),
    );

    registerTextEditorCommand('jsonToObject', (editor: TextEditor) =>
        import('./jsonToObject').then((mod) => mod.jsonToObject(editor)),
    );

    registerTextEditorCommand('spaceGod', (editor: TextEditor) =>
        import('./spaceGod').then((mod) => mod.spaceGod(editor)),
    );

    registerCommand('clearTerminalWithOutputBackup', () =>
        import('./terminalOutputBackup/clearTerminalWithOutputBackup').then((mod) =>
            mod.clearTerminalWithOutputBackup(context),
        ),
    );

    registerCommand('openTerminalOutputBackup', () =>
        import('./terminalOutputBackup/openTerminalOutputBackup').then((mod) =>
            mod.openTerminalOutputBackup(context),
        ),
    );

    registerTextEditorCommand('forcePrettier', () =>
        import('./shellCommands/forcePrettier').then((mod) => mod.forcePrettier()),
    );

    registerTextEditorCommand('forceESLint', () =>
        import('./shellCommands/forceESLint').then((mod) => mod.forceESLint()),
    );

    registerTextEditorCommand('forceStylelint', () =>
        import('./shellCommands/forceStylelint').then((mod) => mod.forceStylelint()),
    );

    registerTextEditorCommand('forceMarkdownlint', () =>
        import('./shellCommands/forceMarkdownlint').then((mod) => mod.forceMarkdownlint()),
    );

    registerTextEditorCommand('activeFileESLintPerformance', () =>
        import('./shellCommands/activeFileESLintPerformance').then((mod) =>
            mod.activeFileESLintPerformance(),
        ),
    );

    registerTextEditorCommand('activeFileESLintConfig', () =>
        import('./shellCommands/activeFileESLintConfig').then((mod) =>
            mod.activeFileESLintConfig(),
        ),
    );

    registerTextEditorCommand('activeFileStylelintConfig', () =>
        import('./shellCommands/activeFileStylelintConfig').then((mod) =>
            mod.activeFileStylelintConfig(),
        ),
    );
}

export function deactivate(): void {
    logger.dispose();
    shellLogger.dispose();
}
