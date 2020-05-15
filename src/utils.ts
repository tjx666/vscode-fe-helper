import { TextEditor, Range } from 'vscode';

/**
 * an utility to replace all text of an editor
 *
 * @param editor
 * @param value
 * @see https://stackoverflow.com/a/50875520/11027903
 */
export function replaceAllTextOfEditor(editor: TextEditor, value: string) {
    const editorDocument = editor.document;
    editor.edit((editBuilder) => {
        const oneLineMoreRange = new Range(0, 0, editorDocument.lineCount, 0);
        const wholeFileRange = editorDocument.validateRange(oneLineMoreRange);
        editBuilder.replace(wholeFileRange, value);
    });
}
