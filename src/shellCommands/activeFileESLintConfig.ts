import { basename } from 'node:path';

import vscode from 'vscode';

import { runShellCommand } from './runShellCommand';

export async function activeFileESLintConfig() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    return runShellCommand('eslint', ['--print-config', '$file'], {
        documentTitle: `ESLint Config of ${basename(editor.document.uri.fsPath)}.json`,
    });
}
