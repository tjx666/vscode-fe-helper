import type { Node, NodePath } from '@babel/traverse';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { TextEditor } from 'vscode';
import vscode, { Position, Range } from 'vscode';

import { parseSourceToAst } from '../utils/ast';

const NO_DEFINITION_OR_HIGHLIGHT = 'No definition or highlight found for';
const ERROR_ANALYZING_CODE = 'Error analyzing code';
const languageUseAst = new Set(['javascript', 'javascriptreact', 'typescript', 'typescriptreact']);

export async function gotoDeclaration(editor: TextEditor): Promise<void> {
    const document = editor.document;
    const position = editor.selection.active;
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange) return;

    const word = document.getText(wordRange);
    const sourceCode = document.getText();

    try {
        if (languageUseAst.has(document.languageId)) {
            const ast = parseSourceToAst(sourceCode);
            const { definitionNode, definitionPath } = findDefinition(ast, word);

            if (definitionNode && definitionPath) {
                const range = getDefinitionRange(definitionNode);
                if (range) {
                    gotoRange(editor, range);
                    return;
                }
            }
        }

        // If no definition found, try to go to the first highlight
        const success = await gotoFirstHighlight(editor, position);
        if (!success) {
            vscode.window.setStatusBarMessage(`${NO_DEFINITION_OR_HIGHLIGHT} '${word}'`, 3000);
        }
    } catch {
        vscode.window.setStatusBarMessage(ERROR_ANALYZING_CODE, 3000);
    }
}

async function gotoFirstHighlight(editor: TextEditor, position: Position): Promise<boolean> {
    const highlights =
        (await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
            'vscode.executeDocumentHighlights',
            editor.document.uri,
            position,
        )) || [];

    if (highlights.length > 0) {
        const firstHighlight = highlights[0];
        gotoRange(editor, firstHighlight.range);
        return true;
    }

    return false;
}

function gotoRange(editor: TextEditor, range: Range): void {
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

function findDefinition(
    ast: t.File,
    word: string,
): { definitionNode: Node | null; definitionPath: NodePath | null } {
    let definitionNode: Node | null = null;
    let definitionPath: NodePath | null = null;

    traverse(ast, {
        Identifier(path) {
            if (path.node.name === word) {
                const binding = path.scope.getBinding(word);
                if (binding) {
                    definitionNode = binding.path.node;
                    definitionPath = binding.path;
                    path.stop();
                }
            }
        },
    });

    return { definitionNode, definitionPath };
}

function getDefinitionRange(node: t.Node): Range | null {
    let loc: t.SourceLocation | null | undefined;

    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
        loc = node.id.loc;
    } else if (t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) {
        loc = node.id?.loc ?? node.loc;
    } else if (
        t.isImportSpecifier(node) ||
        t.isImportDefaultSpecifier(node) ||
        t.isImportNamespaceSpecifier(node)
    ) {
        loc = node.loc;
    } else {
        loc = (node as any).id?.loc ?? node.loc;
    }

    return loc
        ? new Range(
              new Position(loc.start.line - 1, loc.start.column),
              new Position(loc.end.line - 1, loc.end.column),
          )
        : null;
}
