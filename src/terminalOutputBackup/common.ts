import type vscode from 'vscode';

export interface TerminalOutputBackup {
    timestamp: number;
    backupPath: string;
    lastCommand: string | undefined;
}

export const backupKey = 'terminalOutputBackups';

export async function getBackups(context: vscode.ExtensionContext) {
    return (context.globalState.get(backupKey) ?? []) as TerminalOutputBackup[];
}
