import vscode, {
    Range,
    TextDocument,
    TextEditor,
} from 'vscode';

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
export async function replaceAllTextOfEditor(editor: TextEditor, value: string, format = false) {
    const { document } = editor;
    const replaceSuccess = await editor.edit((editBuilder) => {
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        const wholeTextRange = new Range(firstLine.range.start, lastLine.range.end);
        editBuilder.replace(wholeTextRange, value);
    });

    if (format) {
        await vscode.commands.executeCommand('editor.action.formatDocument');
    }

    return replaceSuccess;
}

export function getEOL(document: TextDocument) {
    return document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
}

export function getIndentChar(text: string, eol: string) {
    return text.split(eol).some((line) => line.startsWith('\t')) ? '\t' : ' ';
}
