/**
 * reference: {@link https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API}
 */

import type { ScriptTarget } from 'typescript';

import type { TransformResult } from './type';
import { getTypescript } from './typescript';

export default async function tscCompile(
    source: string,
    target: ScriptTarget,
    cwd: string,
): Promise<TransformResult> {
    const typescript = await getTypescript(cwd);
    const result = typescript.transpileModule(source, {
        compilerOptions: { target },
    });

    return {
        code: result.outputText,
        output: null,
    };
}
