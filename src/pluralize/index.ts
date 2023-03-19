import pluralize from 'pluralize';
import type { TextEditor } from 'vscode';

export async function plur(editor: TextEditor): Promise<void> {
    editor.edit((editorBuilder) => {
        const { document, selections } = editor;
        for (const selection of selections) {
            const word = document.getText(selection);
            const pluralizedWord = pluralize(word);
            editorBuilder.replace(selection, pluralizedWord);
        }
    });
}
