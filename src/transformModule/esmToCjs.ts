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
                visitImportDeclaration(importDeclPath) {
                    const importDeclNode = importDeclPath.node as any;
                    const importDeclRange = new Range(
                        document.positionAt(importDeclNode.start),
                        document.positionAt(importDeclNode.end),
                    );
                    const pkgName = importDeclNode.source.extra.raw;
                    const semicolon =
                        (ast as any).tokens[importDeclNode.loc.end.token - 1].value === ';'
                            ? ';'
                            : '';
                    const requireStatement = ` = require(${pkgName})${semicolon}`;
                    const { specifiers } = importDeclNode;
                    if (specifiers.length === 1) {
                        const onlySpecifier = importDeclNode.specifiers[0];
                        const localName = onlySpecifier.local.name;
                        const { type } = onlySpecifier;
                        // import x from 'packageX' -> const x = require('packageX);
                        // import * as namespaceX from 'packageX' -> const namespaceX = require('packageX')
                        if (
                            type === 'ImportDefaultSpecifier' ||
                            type === 'ImportNamespaceSpecifier'
                        ) {
                            editBuilder.replace(
                                importDeclRange,
                                `const ${localName}${requireStatement}`,
                            );
                        } else if (type === 'ImportSpecifier') {
                            editBuilder.replace(
                                importDeclRange,
                                `const { ${localName} }${requireStatement}`,
                            );
                        }
                    } else if (specifiers.length > 1) {
                        // import { a as namespaceA, b as namespaceB } from 'modA';
                        // import mod1, { modPart1 } from 'moduleName1'
                        // import { modPart2, modPart3 } from 'moduleName2'
                        let cjsString = '';
                        const importDefaultSpecifier = specifiers.find(
                            (specifier: any) => specifier.type === 'ImportDefaultSpecifier',
                        );
                        if (importDefaultSpecifier) {
                            cjsString = `const ${
                                importDefaultSpecifier.local.name
                            }${requireStatement}${document.eol === 1 ? '\n' : '\r\n'}`;
                        }

                        const partImportSpecifiers = specifiers.filter(
                            (specifier: any) => specifier.type === 'ImportSpecifier',
                        );
                        cjsString += 'const { ';
                        cjsString += partImportSpecifiers
                            .map((specifier: any) => {
                                const importedName = specifier.imported.name;
                                const localName = specifier.local.name;
                                return importedName === localName
                                    ? importedName
                                    : `${importedName}: ${localName}`;
                            })
                            .join(', ');
                        cjsString += ` } = require(${pkgName})${semicolon}`;
                        editBuilder.replace(importDeclRange, cjsString);
                    }
                    return false;
                },
            });
        });
    }
}
