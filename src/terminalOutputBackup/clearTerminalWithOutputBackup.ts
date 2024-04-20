import fs from 'node:fs/promises';
import { resolve } from 'node:path';

import vscode from 'vscode';

import { pathExists } from '../utils/fs';
import { backupKey, getBackups } from './common';

const cmdPrefix = '❯';
const commandRegexp = /^❯ .*/gm;
function getLastExecutedCommand(output: string) {
    const commands = [...output.matchAll(commandRegexp)];
    commands.reverse();
    let lastExecutedCommand: string | undefined;

    for (const cmd of commands) {
        const cmdStr = cmd[0].trim();
        // skip empty command
        if (cmdStr !== cmdPrefix) {
            lastExecutedCommand = cmdStr;
            break;
        }
    }

    return lastExecutedCommand;
}

export async function clearTerminalWithOutputBackup(context: vscode.ExtensionContext) {
    // NOTE: should before selectAll because selectAll will also copy all
    const originalClipboardContent = await vscode.env.clipboard.readText();
    let terminalOutput: string;
    try {
        await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
        await vscode.commands.executeCommand('workbench.action.terminal.copyAndClearSelection');
        await vscode.commands.executeCommand('workbench.action.terminal.clear');
        terminalOutput = await vscode.env.clipboard.readText();
    } catch (error) {
        console.error(error);
        return;
    } finally {
        // restore clipboard content
        await vscode.env.clipboard.writeText(originalClipboardContent);
    }

    const storeFolder = context.globalStorageUri.fsPath;
    const backups = await getBackups(context);
    const backupsFolder = resolve(storeFolder, 'terminal-output-backups');
    if (!(await pathExists(backupsFolder))) {
        await fs.mkdir(backupsFolder, { recursive: true });
    }
    const now = Date.now();
    const backupPath = resolve(backupsFolder, `${now}.log`);
    await fs.writeFile(backupPath, terminalOutput, 'utf8');

    // store limit count backups
    const maxBackupCount = 10;
    backups.unshift({
        timestamp: now,
        backupPath,
        lastCommand: getLastExecutedCommand(terminalOutput),
    });
    const newBackups = backups.slice(0, maxBackupCount);
    await context.globalState.update(backupKey, newBackups);

    // remove overflow backups
    const backupsOverflow = backups.slice(maxBackupCount);
    for (const { backupPath } of backupsOverflow) {
        // eslint-disable-next-line no-await-in-loop
        if (await pathExists(backupPath)) {
            // eslint-disable-next-line no-await-in-loop
            await fs.unlink(backupPath);
        }
    }
}
