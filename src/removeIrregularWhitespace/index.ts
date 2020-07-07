import { TextEditor, TextEditorEdit } from 'vscode';

import { getWholeDocumentRange } from '../utils/editor';

function removeIrregular(text: string): string {
    // eslint-disable-next-line no-irregular-whitespace
    const IRREGULAR_WHITESPACE_RE = / /;
    return text.replace(new RegExp(IRREGULAR_WHITESPACE_RE, 'g'), ' ');
}

export default function removeIrregularWhitespace(
    editor: TextEditor,
    editBuilder: TextEditorEdit,
): void {
    const { document } = editor;
    const wholeText = document.getText();
    editBuilder.replace(getWholeDocumentRange(document), removeIrregular(wholeText));
}
