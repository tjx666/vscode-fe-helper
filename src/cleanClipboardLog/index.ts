import vscode from 'vscode';

import { logger } from '../utils/log';
import type { CleanRule } from './cleanLog';
import { cleanLog } from './cleanLog';

const CONFIG_SECTION = 'vscode-fe-helper.cleanClipboardLog';

function ensureTerminal(): void {
    const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal();
    terminal.show(true);
}

export async function cleanClipboardLogToTerminal(): Promise<void> {
    const raw = await vscode.env.clipboard.readText();
    if (raw.length === 0) {
        await vscode.window.showWarningMessage('FE Helper: clipboard is empty.');
        return;
    }

    const config = vscode.workspace.getConfiguration();
    const rules = config.get<CleanRule[]>(`${CONFIG_SECTION}.rules`, []);

    const { output, inputLines, outputLines, skippedRules } = cleanLog(raw, rules);

    // trim trailing newlines so the terminal cursor stays on the last content line,
    // letting the user submit with a single Enter press.
    const trimmed = output.replace(/[\r\n]+$/, '');

    if (trimmed.length === 0) {
        await vscode.window.showWarningMessage(
            'FE Helper: clipboard content was fully filtered out by clean rules.',
        );
        return;
    }

    ensureTerminal();

    // ESC + LF inserts a soft newline in AI CLIs (Claude Code / Codex) without submitting.
    const text = trimmed.replaceAll('\n', '\u001B\n');
    await vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
        text,
    });

    const skippedSuffix = skippedRules > 0 ? `, ${skippedRules} rule(s) skipped` : '';
    vscode.window.setStatusBarMessage(
        `FE Helper: cleaned ${inputLines} → ${outputLines} lines${skippedSuffix}`,
        3000,
    );

    if (skippedRules > 0) {
        logger.log(
            `[cleanClipboardLog] ${skippedRules} rule(s) skipped due to invalid regex — see prior entries`,
        );
    }
}
