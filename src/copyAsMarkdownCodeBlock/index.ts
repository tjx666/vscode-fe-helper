import vscode, {
    Position,
    Range,
    TextEditor,
} from 'vscode';

import { getIndentCorrectText } from '../smartCopy';
import {
    getEOL,
    getIndentChar,
} from '../utils/editor';
import { VSC_MD_LANG_MAP } from './vscMdLangMap';

export default async function copyAsMarkdownCodeBlock(editor: TextEditor): Promise<void> {
    const { document, selections } = editor;
    const eol = getEOL(document);
    const indentChar = getIndentChar(
        document.getText(new Range(new Position(0, 0), new Position(50, 120))),
        eol,
    );
    const selectionsText: string[] = [];
    for (const selection of selections) {
        const code = document.getText(selection);
        const indentCorrectCode = getIndentCorrectText(code, selection.start, indentChar, eol);
        const languageIdentifier = VSC_MD_LANG_MAP.get(document.languageId) ?? '';
        // eslint-disable-next-line prefer-template
        const copiedText = '```' + languageIdentifier + eol + indentCorrectCode + eol + '```' + eol;
        if (copiedText) {
            selectionsText.push(copiedText);
        }
    }
    await vscode.env.clipboard.writeText(selectionsText.join(eol));
}
