import { ScriptTarget } from 'typescript';
import vscode, { TextEditor } from 'vscode';

import { outputPanelLogger } from '../utils/log';
import ES5ToES6 from './ES5ToES6';
import tscCompile from './tscCompile';
import { TransformResult } from './type';

export default async function transformESSyntax(editor: TextEditor): Promise<void> {
    const pickItems = [
        'ES5 to ES6/ES7',
        'Using tsc compile code to ES5',
        'Using tsc compile code to ES3',
    ];
    const pickedTransform = await vscode.window.showQuickPick(pickItems);
    if (pickedTransform) {
        let target: ScriptTarget | undefined;
        if (pickedTransform.endsWith('ES5')) {
            target = ScriptTarget.ES5;
        } else if (pickedTransform.endsWith('ES3')) {
            target = ScriptTarget.ES3;
        }

        const { document, selection } = editor;
        const source = document.getText(selection);
        let result: TransformResult | undefined;
        try {
            result = pickedTransform.startsWith('Using tsc')
                ? tscCompile(source, target!)
                : ES5ToES6(source);
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
