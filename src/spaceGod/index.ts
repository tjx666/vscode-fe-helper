import pangu from 'pangu';
import { TextEditor, TextEditorEdit } from 'vscode';

export default function spaceGod(editor: TextEditor, editBuilder: TextEditorEdit): void {
    const { document, selections } = editor;
    for (const selection of selections) {
        const word = document.getText(selection);
        const spaced = pangu.spacing(word);
        editBuilder.replace(selection, spaced);
    }
}
