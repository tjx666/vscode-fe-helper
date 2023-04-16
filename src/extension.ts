import type { TextEditor, TextEditorEdit } from 'vscode';
import vscode from 'vscode';

import { logger, shellLogger } from './utils/log';
import { store } from './utils/store';

export function activate(context: vscode.ExtensionContext): void {
    store.storageDir = context.storageUri!.fsPath;
    const { commands } = vscode;
    const extName = 'VSCodeFEHelper';

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

    registerTextEditorCommand('transformModuleImports', async (editor: TextEditor) => {
        const { TransformModule } = await import('./transformModuleImports');
        return new TransformModule(editor).handle();
    });

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

    registerTextEditorCommand('forceESLint', (editor) =>
        import('./shellCommands/forceESLint').then((mod) => mod.forceESLint(editor)),
    );

    registerTextEditorCommand('forceStylelint', (editor) =>
        import('./shellCommands/forceStylelint').then((mod) => mod.forceStylelint(editor)),
    );

    registerTextEditorCommand('forceMarkdownlint', (editor) =>
        import('./shellCommands/forceMarkdownlint').then((mod) => mod.forceMarkdownlint(editor)),
    );
}

export function deactivate(): void {
    logger.dispose();
    shellLogger.dispose();
}
