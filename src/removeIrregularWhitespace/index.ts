import type { TextEditor, TextEditorEdit } from 'vscode';

import { getWholeDocumentRange } from '../utils/editor';

function removeIrregular(text: string): string {
    const IRREGULAR_WHITESPACE_RE = / /;
    return text.replaceAll(new RegExp(IRREGULAR_WHITESPACE_RE, 'g'), ' ');
}

export function removeIrregularWhitespace(editor: TextEditor, editBuilder: TextEditorEdit): void {
    const { document } = editor;
    const wholeText = document.getText();
    editBuilder.replace(getWholeDocumentRange(document), removeIrregular(wholeText));
}
