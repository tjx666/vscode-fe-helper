/**
 * reference: {@link https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API}
 */

import resolveFrom from 'resolve-from';
import type { ScriptTarget } from 'typescript';

import type { TransformResult } from './type';

export default async function tscCompile(
    source: string,
    target: ScriptTarget,
    cwd: string,
): Promise<TransformResult> {
    const typescript: any = await resolveFrom(cwd, 'typescript');

    const result = typescript.transpileModule(source, {
        compilerOptions: { target },
    });

    return {
        code: result.outputText,
        output: null,
    };
}
