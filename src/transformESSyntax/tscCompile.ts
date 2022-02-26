/**
 * reference: {@link https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API}
 */

import type { ScriptTarget } from 'typescript';

import { TransformResult } from './type';

export default async function tscCompile(
    source: string,
    target: ScriptTarget,
): Promise<TransformResult> {
    const { default: typescript } = await import('typescript');

    const result = typescript.transpileModule(source, {
        compilerOptions: {
            target,
        },
    });

    return {
        code: result.outputText,
        output: null,
    };
}
