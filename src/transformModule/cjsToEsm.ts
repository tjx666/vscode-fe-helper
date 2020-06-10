import { Range, TextEditor, TextDocument } from 'vscode';
import * as recast from 'recast';

type ASTNode = recast.types.ASTNode;

export default class CjsToESMTransformer {
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
                visitCallExpression(callExpPath) {
                    const callExpNode = callExpPath.node as any;
                    const { arguments: args } = callExpNode;
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
                    const isPureRequireInGlobal =
                        callExpPath.parentPath.node.type === 'ExpressionStatement' &&
                        callExpPath.parentPath.parentPath.node.type === 'Program';
                    if (isPureRequireInGlobal) {
                        console.log(callExpNode);
                        const range = new Range(
                            document.positionAt(callExpNode.start),
                            document.positionAt(callExpNode.end),
                        );
                        editBuilder.replace(range, `import ${pkgName}`);
                    }
                    return false;
                },
            });
        });
    }
}
