import { parse as babelParse } from '@babel/parser';
import * as recast from 'recast';

type ParseResult = ReturnType<typeof babelParse>;

/**
 * Copied from https://github.com/nicoespeon/abracadabra/blob/master/src/ast/transformation.ts#L68
 */
export function babelParseToAst(source: string): ParseResult {
    return babelParse(source, {
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
    });
}

export function parseSourceToAst(source: string): ParseResult {
    return recast.parse(source, {
        parser: {
            parse: babelParseToAst,
        },
    }) as ParseResult;
}
