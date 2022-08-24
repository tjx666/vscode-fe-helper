import vscode, {
    Position,
    Range,
    TextEditor,
} from 'vscode';

import {
    getEOL,
    getIndentChar,
} from '../utils/editor';

export function getIndentCorrectText(
    selectionText: string,
    selectionStart: vscode.Position,
    indentChar: string,
    eol: string,
): string {
    // find most left non space character
    const lines = selectionText.split(eol);
    let mostLeftCharIndex = Number.POSITIVE_INFINITY;
    for (const [index, line] of lines.entries()) {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0) {
            continue;
        }
        let charIndex = line.length - trimmedLine.length;
        if (index === 0) {
            charIndex += selectionStart.character;
        }
        mostLeftCharIndex = Math.min(charIndex, mostLeftCharIndex);
    }

    // remove extra space
    const resultLines: string[] = [];
    for (const [index, line] of lines.entries()) {
        let realLine = line;
        if (index === 0 && selectionStart.character !== 0) {
            const padSpace = indentChar.repeat(selectionStart.character);
            realLine = padSpace + realLine;
        }
        resultLines.push(realLine.slice(mostLeftCharIndex));
    }

    // remove empty lines before text
    for (let i = 0; i < resultLines.length; i++) {
        if (resultLines[i].trim().length === 0) {
            resultLines.shift();
        } else {
            break;
        }
    }

    // remove empty lines after text
    for (let i = resultLines.length - 1; i >= 0; i--) {
        if (resultLines[i].trim().length === 0) {
            resultLines.pop();
        } else {
            break;
        }
    }

    return resultLines.join(eol);
}

export default async function smartCopy(editor: TextEditor): Promise<void> {
    const { document, selections } = editor;
    const eol = getEOL(document);
    const indentChar = getIndentChar(
        document.getText(new Range(new Position(0, 0), new Position(50, 120))),
        eol,
    );
    const selectionsText: string[] = [];
    for (const selection of selections) {
        const selectionText = getIndentCorrectText(
            document.getText(selection),
            selection.start,
            indentChar,
            eol,
        );
        if (selectionText) {
            selectionsText.push(selectionText);
        }
    }
    await vscode.env.clipboard.writeText(selectionsText.join(eol));
}
