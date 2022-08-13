import type { ASTNode } from 'ast-types';
import {
    Range,
    TextDocument,
    TextEditor,
} from 'vscode';

export default class CjsToESMTransformer {
    private readonly editor: TextEditor;
    private readonly document: TextDocument;
    private readonly ast: ASTNode;

    constructor(editor: TextEditor, document: TextDocument, ast: ASTNode) {
        this.editor = editor;
        this.document = document;
        this.ast = ast;
    }

    public async transform(): Promise<void> {
        const recast = await import('recast');
        const { editor, document, ast } = this;
        editor.edit((editBuilder) => {
            recast.visit(ast, {
                visitCallExpression(callExpPath) {
                    const callExpNode = callExpPath.node as any;
                    const { arguments: args, start, end } = callExpNode;
                    // require('packageX') or template string without variable: require(`packageX`)
                    const isImportCallExp =
                        args.length === 1 &&
                        (args[0].type === 'StringLiteral' ||
                            (args[0].type === 'TemplateLiteral' &&
                                args[0].expressions.length === 0));
                    if (!isImportCallExp) return false;
                    const pkgName =
                        args[0].type === 'StringLiteral'
                            ? args[0].extra.raw
                            : `'${args[0].quasis.map((q: any) => q.value.raw)}'`;

                    // require('pkg')
                    const parentNode = callExpPath.parentPath.node;
                    const isPureRequireInGlobal =
                        parentNode.type === 'ExpressionStatement' &&
                        callExpPath.parentPath.parentPath.node.type === 'Program';
                    if (isPureRequireInGlobal) {
                        const range = new Range(
                            document.positionAt(start),
                            document.positionAt(end),
                        );
                        const semicolon =
                            (ast as any).tokens[parentNode.loc.end.token - 1].value === ';'
                                ? ';'
                                : '';
                        editBuilder.replace(range, `import ${pkgName}${semicolon}`);
                        return false;
                    }

                    const variableDeclNode = callExpPath.parentPath.parentPath.node;
                    const isVariableDeclaration =
                        parentNode.type === 'VariableDeclarator' &&
                        variableDeclNode.type === 'VariableDeclaration';
                    if (isVariableDeclaration) {
                        const variableDeclRange = new Range(
                            document.positionAt(variableDeclNode.start),
                            document.positionAt(variableDeclNode.end),
                        );
                        const semicolon =
                            (ast as any).tokens[variableDeclNode.loc.end.token - 1].value === ';'
                                ? ';'
                                : '';
                        const identifier = parentNode.id;
                        if (identifier.type === 'Identifier') {
                            // const x = require('packageX') -> import x from 'packageX'
                            editBuilder.replace(
                                variableDeclRange,
                                `import ${identifier.name} from ${pkgName}${semicolon}`,
                            );
                        } else if (identifier.type === 'ObjectPattern') {
                            // const { a: aliasA, b } = require('packageX') -> import { a as aliasA, b } from 'packageX'
                            const importedString = identifier.properties
                                .map((prop: any) =>
                                    prop.shorthand
                                        ? prop.key.name
                                        : `${prop.key.name} as ${prop.value.name}`,
                                )
                                .join(', ');
                            editBuilder.replace(
                                variableDeclRange,
                                `import { ${importedString} } from ${pkgName}${semicolon}`,
                            );
                        }
                    }
                    return false;
                },
            });
        });
    }
}
