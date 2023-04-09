import vscode from 'vscode';

import { getBackups } from './common';
import { openDocument } from '../utils/editor';

export async function openTerminalOutputBackup(context: vscode.ExtensionContext) {
    const backups = await getBackups(context);
    const selectedBackup = await vscode.window.showQuickPick(
        backups.map((backup) => {
            return {
                label: new Date(backup.timestamp).toLocaleTimeString(),
                detail: backup.lastCommand,
                value: backup,
            };
        }),
    );

    if (selectedBackup) {
        await openDocument(vscode.Uri.file(selectedBackup.value.backupPath));
    }
}
