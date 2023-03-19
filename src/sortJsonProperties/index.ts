import * as jsonc from 'jsonc-parser';
import type { TextEditor } from 'vscode';

export async function sortJsonProperties(editor: TextEditor): Promise<void> {
    const code = editor.document.getText(editor.selection);
    const tree = jsonc.parse(code);
    console.log(tree);
}
