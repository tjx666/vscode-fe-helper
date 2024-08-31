import type { Node, NodePath } from '@babel/traverse';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { TextEditor } from 'vscode';
import vscode, { Position, Range } from 'vscode';

import { parseSourceToAst } from '../utils/ast';

const UNABLE_TO_LOCATE = 'Unable to locate precise definition for';
const NO_DEFINITION_FOUND = 'No definition found for';
const ERROR_ANALYZING_CODE = 'Error analyzing code';
const messageDuration = 3000;

export function gotoDeclaration(editor: TextEditor): void {
    const document = editor.document;
    const position = editor.selection.active;
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange) return;

    const word = document.getText(wordRange);
    const sourceCode = document.getText();

    try {
        const ast = parseSourceToAst(sourceCode);
        const { definitionNode, definitionPath } = findDefinition(ast, word);

        if (!definitionNode || !definitionPath) {
            vscode.window.setStatusBarMessage(`${NO_DEFINITION_FOUND} '${word}'`, messageDuration);
            return;
        }

        const range = getDefinitionRange(definitionNode);
        if (!range) {
            vscode.window.setStatusBarMessage(`${UNABLE_TO_LOCATE} '${word}'`, messageDuration);
            return;
        }

        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch {
        vscode.window.setStatusBarMessage(ERROR_ANALYZING_CODE, messageDuration);
    }
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
