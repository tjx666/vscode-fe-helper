import { Range, TextEditor, TextDocument } from 'vscode';
import * as recast from 'recast';

type ASTNode = recast.types.ASTNode;

export default class EsmToCjsTransformer {
    private readonly editor: TextEditor;
    private readonly document: TextDocument;
    private readonly ast: ASTNode;

    constructor(editor: TextEditor, document: TextDocument, ast: ASTNode) {
        this.editor = editor;
        this.document = document;
        this.ast = ast;
    }

    public transform(): void {
        const { editor, document, ast } = this;
        editor.edit((editBuilder) => {
            recast.visit(ast, {
                visitImportDeclaration(importDclPath) {
                    const node = importDclPath.node as any;
                    const importDclRange = new Range(
                        document.positionAt(node.start),
                        document.positionAt(node.end),
                    );
                    const pkgName = node.source.extra.raw;
                    const semicolon =
                        (ast as any).tokens[node.loc.end.token - 1].value === ';' ? ';' : '';

                    // import x from 'packageX' -> const x = require('packageX);
                    if (node.specifiers.length === 1) {
                        const defaultImportNode = node.specifiers[0];
                        if (defaultImportNode.type === 'ImportDefaultSpecifier') {
                            editBuilder.replace(
                                importDclRange,
                                `const ${defaultImportNode.local.name} = require(${pkgName})${semicolon}`,
                            );
                        }
                    }

                    // import * as namespaceX from 'packageX' -> const namespaceX = require('packageX')
                    this.visit(importDclPath, {
                        visitImportNamespaceSpecifier(importNamespacePath) {
                            editBuilder.replace(
                                importDclRange,
                                `const ${importNamespacePath.node.local.name} = require(${pkgName})${semicolon}`,
                            );
                            return false;
                        },
                    });
                },
            });
        });
    }
}
