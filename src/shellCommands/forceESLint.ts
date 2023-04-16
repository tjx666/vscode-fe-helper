import type { TextEditor } from 'vscode';

import { runShellCommand } from './runShellCommand';

export async function forceESLint(editor: TextEditor) {
    return runShellCommand(editor, 'eslint', ['--no-ignore', '$file']);
}
