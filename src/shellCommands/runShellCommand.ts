import fs from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';
import type { TextEditor } from 'vscode';
import vscode from 'vscode';

import { pathExists } from '../utils/fs';
import { shellLogger } from '../utils/log';
import { store } from '../utils/store';

export async function runShellCommand(editor: TextEditor, shellCommand: string, args: string[]) {
    const storageDir = store.storageDir!;
    if (!(await pathExists(storageDir))) {
        await fs.mkdir(storageDir);
    }

    const emptyIgnoreFile = resolve(storageDir, '.empty-ignore');
    if (!(await pathExists(emptyIgnoreFile))) {
        await fs.writeFile(emptyIgnoreFile, '', 'utf8');
    }

    const documentUri = editor.document.uri;
    const workspace = vscode.workspace.getWorkspaceFolder(documentUri);
    if (!workspace) return;

    args = args.map((arg) =>
        arg.replace('$file', documentUri.fsPath).replace('$emptyIgnoreFile', emptyIgnoreFile),
    );
    const { escapedCommand, stdout, stderr } = await execa(shellCommand, args, {
        cwd: workspace.uri.fsPath,
        preferLocal: true,
        reject: false,
        timeout: 10 * 1000,
    });
    shellLogger.log(`$ ${escapedCommand}\n${stderr || stdout || ''}`, true);
    return stdout;
}
