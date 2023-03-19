import resolveFrom from 'resolve-from';
import type TS from 'typescript';

export async function getTypescript(cwd: string) {
    const typescriptModulePath = await resolveFrom(cwd, 'typescript');
    // eslint-disable-next-line security/detect-non-literal-require, @typescript-eslint/no-var-requires
    return require(typescriptModulePath) as typeof TS;
}
