import { parse as babelParse } from '@babel/parser';
import recast from 'recast';

export async function parseSourceToAst(source: string): Promise<any> {
    return recast.parse(source, {
        parser: {
            // copied from https://github.com/nicoespeon/abracadabra/blob/master/src/ast/transformation.ts#L68
            parse: (sourceCode: string): any =>
                babelParse(sourceCode, {
                    sourceType: 'module',
                    allowImportExportEverywhere: true,
                    allowReturnOutsideFunction: true,
                    startLine: 1,
                    tokens: true,
                    plugins: [
                        'dynamicImport',
                        'exportDefaultFrom',
                        'exportNamespaceFrom',
                        'importMeta',
                        'jsx',
                        'typescript',
                    ],
                }),
        },
    });
}
