import { TextEditor, TextEditorEdit } from 'vscode';
import pangu from 'pangu';

export default function spaceGod(editor: TextEditor, editBuilder: TextEditorEdit): void {
    const { document, selections } = editor;
    selections.forEach((selection) => {
        const word = document.getText(selection);
        const spaced = pangu.spacing(word);
        editBuilder.replace(selection, spaced);
    });
}
