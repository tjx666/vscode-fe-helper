import { basename } from 'node:path';

import vscode from 'vscode';

import { runShellCommand } from './runShellCommand';

export async function activeFileStylelintConfig() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    return runShellCommand('stylelint', ['--print-config', '$file'], {
        documentTitle: `Stylelint Config of ${basename(editor.document.uri.fsPath)}.json`,
    });
}
