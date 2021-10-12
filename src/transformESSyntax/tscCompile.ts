/**
 * reference: {@link https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API}
 */

import type { ScriptTarget } from 'typescript';
import * as ts from 'typescript';

import { TransformResult } from './type';

export default function tscCompile(source: string, target: ScriptTarget): TransformResult {
    const result = ts.transpileModule(source, {
        compilerOptions: {
            target,
        },
    });

    return {
        code: result.outputText,
        output: null,
    };
}
