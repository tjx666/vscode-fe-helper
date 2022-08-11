/**
 * reference: {@link https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API}
 */

import resolveFrom from 'resolve-from';
import type { ScriptTarget } from 'typescript';

import { TransformResult } from './type';

export default async function tscCompile(
    source: string,
    target: ScriptTarget,
    cwd: string,
): Promise<TransformResult> {
    const localInstalledTs = await resolveFrom(cwd, 'typescript');
    const typescript = __non_webpack_require__(localInstalledTs ?? 'typescript');

    const result = typescript.transpileModule(source, {
        compilerOptions: { target },
    });

    return {
        code: result.outputText,
        output: null,
    };
}
