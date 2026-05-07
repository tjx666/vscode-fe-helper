import type { OutputChannel } from 'vscode';
import vscode from 'vscode';

import { EXTENSION_NAME } from './constants';

export function log(message: string): void {
    console.log(`[${EXTENSION_NAME}] ${new Date().toISOString()} ${message}`);
}

class Logger {
    channel: OutputChannel | undefined;

    constructor(
        private name: string,
        private language: string,
    ) {}

    log(message: string, active = false): void {
        if (this.channel === undefined) {
            const prefix = 'FE Helper';
            this.channel = vscode.window.createOutputChannel(
                `${prefix} ${this.name}`.trim(),
                this.language,
            );
        }
        this.channel.append(`${message}\n`);
        if (active) {
            this.channel.show();
        }
    }

    dispose(): void {
        this.channel?.dispose();
    }
}

export const logger = new Logger('', 'log');
export const shellLogger = new Logger('Shell', 'shellscript');

export function logEvent(scope: string, message: string): void {
    logger.log(`${new Date().toISOString()} [${scope}] ${message}`);
}

export function logTiming(scope: string, startedAt: number, extra?: string): void {
    const ms = Date.now() - startedAt;
    logger.log(
        `${new Date().toISOString()} [${scope}] ${ms}ms${extra === undefined ? '' : ` ${extra}`}`,
    );
}
