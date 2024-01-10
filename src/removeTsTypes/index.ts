import fs from 'node:fs/promises';
import path from 'node:path';

import { execa } from 'execa';
import type { Range, TextEditor } from 'vscode';

import { getWholeDocumentRange } from '../utils/editor';
import { store } from '../utils/store';

export async function removeTsTypes(editor: TextEditor) {
    const { document, selection } = editor;

    let range: Range = selection;
    // no selection will transform whole editor
    if (document.getText(selection).length === 0) {
        range = getWholeDocumentRange(document);
    }

    const tsSourceCode = document.getText(range);
    const tempFilePath = path.resolve(store.storageDir!, 'temp-removeTsTypes.ts');
    await fs.writeFile(tempFilePath, tsSourceCode, 'utf8');
    const { stdout: jsCode } = await execa('swc', [
        tempFilePath,
        '--config',
        'jsc.target=esnext',
        '--quiet',
    ]);
    await editor.edit((editBuilder) => {
        editBuilder.replace(range!, jsCode);
    });
}
