import vscode, { TextEditor, TextDocument, Range } from 'vscode';

export function getWholeDocumentRange(document: TextDocument): Range {
    const oneLineMoreRange = new Range(0, 0, document.lineCount, 0);
    return document.validateRange(oneLineMoreRange);
}

/**
 * an utility to replace all text of an editor
 *
 * @param editor
 * @param value
 * @see https://stackoverflow.com/a/50875520/11027903
 */
export function replaceAllTextOfEditor(
    editor: TextEditor,
    value: string,
    format = false,
): Thenable<boolean> {
    const editorDocument = editor.document;
    return editor.edit((editBuilder) => {
        const oneLineMoreRange = new Range(0, 0, editorDocument.lineCount, 0);
        const wholeFileRange = editorDocument.validateRange(oneLineMoreRange);
        editBuilder.replace(wholeFileRange, value);
        if (format) {
            vscode.commands.executeCommand('editor.action.formatDocument');
        }
    });
}
