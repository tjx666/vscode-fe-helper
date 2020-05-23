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
                    const startPosition = document.positionAt(node.start);
                    const endPosition = document.positionAt(node.end);
                    const moduleName = node.source.extra.raw;
                    const { tokens } = ast as any;
                    const semicolon = tokens[node.loc.end.token - 1].value === ';' ? ';' : '';

                    this.visit(importDclPath, {
                        // deal with import * as namespace from 'modName'
                        visitImportNamespaceSpecifier(importNamespacePath) {
                            editBuilder.replace(
                                new Range(startPosition, endPosition),
                                `const ${importNamespacePath.node.local.name} = require(${moduleName})${semicolon}`,
                            );
                            return false;
                        },
                    });
                },
            });
        });
    }
}
