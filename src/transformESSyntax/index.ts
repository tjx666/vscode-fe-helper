import { dirname } from 'node:path';

import type TS from 'typescript';
import type { TextEditor } from 'vscode';
import vscode from 'vscode';

import ES5ToES6 from './ES5ToES6';
import tscCompile from './tscCompile';
import type { TransformResult } from './type';
import { getTypescript } from './typescript';
import { outputPanelLogger } from '../utils/log';

export async function transformESSyntax(editor: TextEditor): Promise<void> {
    const { document, selection } = editor;
    const cwd = dirname(document.uri.fsPath);
    const { ScriptTarget } = await getTypescript(cwd);
    const pickItems = [
        'ES5 to ES6/ES7',
        'Using tsc compile code to ES5',
        'Using tsc compile code to ES3',
    ];
    const pickedTransform = await vscode.window.showQuickPick(pickItems);
    if (pickedTransform) {
        let target: TS.ScriptTarget | undefined;
        if (pickedTransform.endsWith('ES5')) {
            target = ScriptTarget.ES5;
        } else if (pickedTransform.endsWith('ES3')) {
            target = ScriptTarget.ES3;
        }

        const source = document.getText(selection);
        let result: TransformResult | undefined;
        try {
            result = pickedTransform.startsWith('Using tsc')
                ? await tscCompile(source, target!, cwd)
                : await ES5ToES6(source);
        } catch (error) {
            console.error(error);
            outputPanelLogger.log(`transform syntax error:${String(error)}`);
            return;
        }

        if (result?.output) {
            outputPanelLogger.log(result.output);
        }

        if (result.code) {
            editor.edit((editBuilder) => {
                editBuilder.replace(selection, result!.code);
            });
        }
    }
}
