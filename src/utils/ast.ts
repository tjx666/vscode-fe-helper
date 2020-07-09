import * as recast from 'recast';
import { parse as babelParse } from '@babel/parser';

export function parseSourceToAst(source: string): any {
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
