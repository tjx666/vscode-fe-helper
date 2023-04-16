import type { TextEditor } from 'vscode';

import { runShellCommand } from './runShellCommand';

export async function forceStylelint(editor: TextEditor) {
    return runShellCommand(editor, 'stylelint', ['--ignore-path', '$emptyIgnoreFile', '$file']);
}
