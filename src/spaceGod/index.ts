import pangu from 'pangu';
import type { TextEditor } from 'vscode';

export async function spaceGod(editor: TextEditor): Promise<void> {
    editor.edit((editBuilder) => {
        const { document, selections } = editor;
        for (const selection of selections) {
            const word = document.getText(selection);
            const spaced = pangu.spacing(word);
            editBuilder.replace(selection, spaced);
        }
    });
}
