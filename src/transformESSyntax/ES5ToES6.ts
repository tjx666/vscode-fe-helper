/**
 * reference: {@link https://github.com/mrmlnc/vscode-lebab/blob/master/src/extension.ts}
 */

import type { TransformResult } from './type';

export default async function ES5ToES6(source: string): Promise<TransformResult> {
    const { transform } = await import('lebab');
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
