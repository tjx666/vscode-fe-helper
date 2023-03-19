import type { TextEditor } from 'vscode';
import vscode from 'vscode';

import CjsToESMTransformer from './cjsToEsm';
import EsmToCjsTransformer from './esmToCjs';
import { parseSourceToAst } from '../utils/ast';

export class TransformModule {
    private readonly editor: TextEditor;

    constructor(editor: TextEditor) {
        this.editor = editor;
    }

    async handle(): Promise<void> {
        const transformWays = {
            esm2cjs: 'ES6 module -> CommonJS',
            cjs2esm: 'CommonJS -> ES6 module',
        };
        const transformWay = await vscode.window.showQuickPick(Object.values(transformWays), {
            placeHolder: 'please select one transform way...',
        });
        if (transformWay === undefined) return;

        const { editor } = this;
        const { document } = editor;
        const ast = await parseSourceToAst(document.getText());
        if (transformWay === transformWays.esm2cjs) {
            await new EsmToCjsTransformer(editor, document, ast).transform();
        } else if (transformWay === transformWays.cjs2esm) {
            await new CjsToESMTransformer(editor, document, ast).transform();
        }
    }
}
