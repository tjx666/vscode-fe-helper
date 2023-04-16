import vscode from 'vscode';

export async function forcePrettier() {
    return vscode.commands.executeCommand('prettier.forceFormatDocument');
}
