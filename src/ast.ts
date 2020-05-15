import * as recast from 'recast';
import { parse as babelParse } from '@babel/parser';

export function parseSourceToAst(source: string) {
    return recast.parse(source, {
        parser: {
            parse: (source: string) =>
                // copy from https://github.com/nicoespeon/abracadabra/blob/master/src/ast/transformation.ts#L68
                babelParse(source, {
                    sourceType: 'module',
                    allowImportExportEverywhere: true,
                    allowReturnOutsideFunction: true,
                    startLine: 1,
                    tokens: true,
                    plugins: [
                        'asyncGenerators',
                        'bigInt',
                        'classPrivateMethods',
                        'classPrivateProperties',
                        'classProperties',
                        // Not compatible with "decorators-legacy"
                        // "decorators",
                        'decorators-legacy',
                        'doExpressions',
                        'dynamicImport',
                        // Make tests fail, not sure why
                        // "estree",
                        'exportDefaultFrom',
                        'exportNamespaceFrom',
                        // Not compatible with "typescript"
                        // "flow",
                        // "flowComments",
                        'functionBind',
                        'functionSent',
                        'importMeta',
                        'jsx',
                        'logicalAssignment',
                        'nullishCoalescingOperator',
                        'numericSeparator',
                        'objectRestSpread',
                        'optionalCatchBinding',
                        'optionalChaining',
                        'partialApplication',
                        ['pipelineOperator', { proposal: 'minimal' }],
                        'placeholders',
                        'throwExpressions',
                        'topLevelAwait',
                        'typescript',
                        // Not compatible with "placeholders"
                        // "v8intrinsic"
                    ],
                }),
        },
    });
}
