import type { TextEditor } from 'vscode';

export async function plur(editor: TextEditor): Promise<void> {
    const { default: pluralize } = await import('pluralize');
    editor.edit((editorBuilder) => {
        const { document, selections } = editor;
        for (const selection of selections) {
            const word = document.getText(selection);
            const pluralizedWord = pluralize(word);
            editorBuilder.replace(selection, pluralizedWord);
        }
    });
}
