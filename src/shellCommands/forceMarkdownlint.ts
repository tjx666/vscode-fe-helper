import type { TextEditor } from 'vscode';

import { runShellCommand } from './runShellCommand';

export async function forceMarkdownlint(editor: TextEditor) {
    return runShellCommand(editor, 'markdownlint', ['--ignore-path', '$emptyIgnoreFile', '$file']);
}
