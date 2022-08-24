import type { OutputChannel } from 'vscode';
import vscode from 'vscode';

import { EXTENSION_NAME } from './constants';

function log(message: string): void {
    console.log(`[${EXTENSION_NAME}] ${new Date().toISOString()} ${message}`);
}

let feHelperOutputChannel: OutputChannel | undefined;
const outputPanelLogger = {
    log(message: string): void {
        if (feHelperOutputChannel === undefined) {
            feHelperOutputChannel = vscode.window.createOutputChannel('FE Helper');
        }
        feHelperOutputChannel.append(message);
        feHelperOutputChannel.show();
    },
    dispose(): void {
        feHelperOutputChannel?.dispose();
    },
};

export { log, outputPanelLogger };
