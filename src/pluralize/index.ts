import pluralize from 'pluralize';
import { TextEditor, TextEditorEdit } from 'vscode';

export default function plur(editor: TextEditor, editBuilder: TextEditorEdit): void {
    const { document, selections } = editor;
    for (const selection of selections) {
        const word = document.getText(selection);
        const pluralizedWord = pluralize(word);
        editBuilder.replace(selection, pluralizedWord);
    }
}
