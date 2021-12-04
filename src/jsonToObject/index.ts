import vscode, { TextEditor } from 'vscode';

export default async function jsonToObject(editor: TextEditor): Promise<void> {
    const json = await vscode.env.clipboard.readText();
    const jsCode = json.replace(/"([^"]*)"\s*:/gm, '$1:');
    editor.edit((builder) => {
        const selectionText = editor.document.getText(editor.selection);
        if (selectionText.length === 0) {
            builder.insert(editor.selection.active, jsCode);
        } else {
            builder.replace(editor.selection, jsCode);
        }
    });
}
