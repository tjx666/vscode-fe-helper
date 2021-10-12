/**
 * reference: {@link https://github.com/mrmlnc/vscode-lebab/blob/master/src/extension.ts}
 */

import { transform } from 'lebab';

import { TransformResult } from './type';

export default function ES5ToES6(source: string): TransformResult {
    const transformers = [
        // safe
        'arrow',
        'arrow-return',
        'for-of',
        'for-each',
        'arg-rest',
        'arg-spread',
        'obj-method',
        'obj-shorthand',
        'no-strict',
        'exponent',
        'multi-var',

        // unsafe
        'let',
        'class',
        'commonjs',
        'template',
        'default-param',
        'destruct-param',
        'includes',
    ];
    const result = transform(source, transformers);

    return {
        code: result.code,
        output: result.warnings?.length > 1 ? JSON.stringify(result.warnings, null, 2) : null,
    };
}
