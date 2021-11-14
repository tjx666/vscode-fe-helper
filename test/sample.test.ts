import { strictEqual } from 'assert';
import * as vscode from 'vscode';

describe('#test sample', () => {
    before(() => {
        vscode.window.showInformationMessage('Test begin!');
    });

    it('hello world', async () =>
        // delay to see the vscode notification
        new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, 1.5 * 1000);
        }));

    it('one plus one equals two', () => {
        strictEqual(2, 1 + 1);
    });

    after(() => {
        vscode.window.showInformationMessage('Test end!');
    });
});
