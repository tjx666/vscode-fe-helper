import vscode, { TextEditor } from 'vscode';

export default function copyWithLineNumber(editor: TextEditor): void {
    const { document, selection } = editor;
    const selectionText = document.getText(selection);
    const startLineNumber = selection.start.line + 1;
    const endLineNumber = selection.end.line + 1;
    const numberLength = String(endLineNumber).length;
    const EOL = document.eol === 1 ? '\n' : '\r\n';
    const textWithLineNumbers = selectionText
        .split(EOL)
        .map(
            (line, index) =>
                `${String(startLineNumber + index).padStart(numberLength, ' ')} ${line}`,
        )
        .join(EOL);
    vscode.env.clipboard.writeText(textWithLineNumbers);
}
