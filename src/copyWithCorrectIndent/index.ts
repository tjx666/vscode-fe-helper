/**
 * reference: https://github.com/bmaupin/vscode-copy-without-formatting/blob/master/src/extension.ts
 */
import vscode, { TextEditor } from 'vscode';

// function getIndentCorrctText(selection: vscode.Selection): string {}

export default async function copyWithLineNumber(editor: TextEditor): Promise<void> {
    if (editor.selections.length === 1) {
        const { document, selection } = editor;
        if (!document) return;

        const selectedText = document.getText(selection);
        if (!selectedText) return;

        await vscode.env.clipboard.writeText(selectedText);
    } else {
        // When there are multiple selections (due to multiple cursors), vscode doesn't seem to copy the formatting.
        // So just cheat and use the default built-in copy functionality.
        vscode.commands.executeCommand('editor.action.clipboardCopyAction');
    }
}
