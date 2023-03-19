import type { TextEditor } from 'vscode';
import vscode from 'vscode';

export async function transformColorFormat(editor: TextEditor): Promise<void> {
    const { default: Color } = await import('color');
    const { document, selection } = editor;
    const transformers = {
        'transform to hex': (colorStr: string) => Color(colorStr).hex(),
        'transform to rgb/rgba': (colorStr: string) => Color(colorStr).rgb().string(),
        'transform to cmyk': (colorStr: string) => Color(colorStr).cmyk().string(),
        'transform to hsv': (colorStr: string) => Color(colorStr).hsv().string(),
        'transform to hsl': (colorStr: string) => Color(colorStr).hsl().string(),
        'transform to ansi16': (colorStr: string) => Color(colorStr).ansi16().string(),
        'transform to ansi256': (colorStr: string) => Color(colorStr).ansi256().string(),
    };
    const colorStr = document.getText(selection);
    const mode = (await vscode.window.showQuickPick(Object.keys(transformers))) as
        | keyof typeof transformers
        | undefined;
    if (mode) {
        editor.edit((editBuilder) => {
            editBuilder.replace(selection, transformers[mode](colorStr));
        });
    }
}
