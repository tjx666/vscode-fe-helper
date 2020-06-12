import { TextEditor, TextEditorEdit } from 'vscode';
import pluralize from 'pluralize';

export default function plur(editor: TextEditor, editBuilder: TextEditorEdit): void {
    const { document, selections } = editor;
    selections.forEach((selection) => {
        const word = document.getText(selection);
        const pluralizedWord = pluralize(word);
        editBuilder.replace(selection, pluralizedWord);
    });
}
