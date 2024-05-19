import fs from 'node:fs/promises';
import { extname } from 'node:path';

import type { ASTNode } from 'ast-types';
import * as recast from 'recast';
import vscode, { type ExtensionContext } from 'vscode';

import { getSettings } from '../jsUnicodePreview/util';
import { parseSourceToAst } from '../utils/ast';

/**
 * 文件保存的时候，如果文件时 .js 或者 .ts，但是包含 jsx 元素，提示用户修改文件后缀为 .jsx
 */
export function checkJsxFileExtension(context: ExtensionContext) {
    let config = { fileExtensions: [] as string[] };
    const settingSection = 'vscode-fe-helper.check-jsx-extension';
    const updateConfig = () => {
        config = getSettings(settingSection, ['fileExtensions']);
    };
    updateConfig();

    vscode.workspace.onDidChangeConfiguration(
        async (event) => {
            if (event.affectsConfiguration(settingSection)) {
                await updateConfig();
            }
        },
        null,
        context.subscriptions,
    );

    vscode.workspace.onDidSaveTextDocument(
        async (document) => {
            const { fsPath } = document.uri;
            const fileExt = extname(fsPath);
            const autoSave = vscode.workspace.getConfiguration().get<string>('files.autoSave');
            const autoSaveDelay = vscode.workspace
                .getConfiguration()
                .get<number>('files.autoSaveDelay');
            if (
                document !== vscode.window.activeTextEditor?.document ||
                !config.fileExtensions.includes(fileExt) ||
                (autoSave === 'afterDelay' && autoSaveDelay && autoSaveDelay < 1000)
            ) {
                return;
            }

            // use fs to check file size too large
            const stat = await fs.stat(fsPath);
            // 50kb
            const sizeLimit = 1024 * 1024 * 100;
            if (stat.size > sizeLimit) {
                return;
            }

            const source = document.getText();
            let ast: ASTNode;
            try {
                ast = await parseSourceToAst(source);
            } catch {
                // ignore syntax error
                return;
            }

            const notify = async () => {
                const correctFileExt = fileExt === '.js' ? '.jsx' : '.tsx';
                const changeAction = `Change to ${correctFileExt}`;
                const action = await vscode.window.showWarningMessage(
                    `Your ${fileExt} code contains JSX elements, consider change the file extension to ${correctFileExt}!`,
                    changeAction,
                );
                if (action === changeAction) {
                    await vscode.workspace.fs.rename(
                        document.uri,
                        document.uri.with({
                            path: fsPath.replace(fileExt, correctFileExt),
                        }),
                    );
                }
            };

            recast.visit(ast, {
                visitJSXElement() {
                    notify();
                    return false;
                },
            });
        },
        null,
        context.subscriptions,
    );
}
