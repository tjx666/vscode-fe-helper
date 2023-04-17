import fs from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';
import vscode from 'vscode';

import { replaceAllTextOfEditor } from '../utils/editor';
import { pathExists } from '../utils/fs';
import { shellLogger } from '../utils/log';
import { store } from '../utils/store';

interface Options {
    env?: Record<string, string>;
    logOutput?: boolean;
    documentTitle?: string;
}

export async function runShellCommand(shellCommand: string, args: string[], options?: Options) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

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
    const start = Date.now();
    const { escapedCommand, stdout, stderr, exitCode, failed } = await execa(shellCommand, args, {
        cwd: workspace.uri.fsPath,
        preferLocal: true,
        reject: false,
        timeout: 10 * 1000,
        ...options,
    });
    const costs = ((Date.now() - start) / 1000).toFixed(3);
    const profile = `exit: ${exitCode} cost: ${costs}s`;
    if (failed || options?.documentTitle === undefined) {
        shellLogger.log(`${escapedCommand}\n${stderr || stdout || ''}\n\n${profile}`, true);
    } else {
        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(`untitled:/${options.documentTitle}`),
        );
        const editor = await vscode.window.showTextDocument(document);
        await replaceAllTextOfEditor(editor, stdout, true);
        await vscode.commands.executeCommand('editor.foldLevel2');
        shellLogger.log(`${escapedCommand}\n${profile}`);
    }
    return stdout;
}
