import * as process from 'node:process';

import { execa } from 'execa';

import { logger } from '../utils/log';

export type CliErrorKind = 'NOT_LOGGED_IN' | 'NOT_LINKED' | 'TIMEOUT' | 'NOT_FOUND' | 'OTHER';

export class CliError extends Error {
    kind: CliErrorKind;
    stderr: string;

    constructor(kind: CliErrorKind, stderr: string, message?: string) {
        super(message ?? `${kind}: ${stderr || 'unknown error'}`);
        this.kind = kind;
        this.stderr = stderr;
    }
}

const TIMEOUT_MS = 8000;
const MAX_BUFFER = 4 * 1024 * 1024;

export async function runCli(cmd: 'gh' | 'vc', args: string[], cwd: string): Promise<string> {
    const result = await execa(cmd, args, {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        reject: false,
        // CI=1 forces vc to skip its TTY prompt; gh respects it too.
        env: { ...process.env, CI: '1' },
    });
    if (!result.failed) return result.stdout;

    const stderr = result.stderr ?? '';
    const err = result as { code?: string; timedOut?: boolean };

    if (err.code === 'ENOENT') {
        throw new CliError('NOT_FOUND', '', `${cmd} not installed`);
    }
    if (err.timedOut) {
        throw new CliError('TIMEOUT', stderr, `${cmd} timed out`);
    }
    if (
        /auth(?:entication)? required|please run.*auth login|not logged in|login required/i.test(
            stderr,
        )
    ) {
        throw new CliError('NOT_LOGGED_IN', stderr);
    }
    if (/not linked|no project|please run.*link|link this directory/i.test(stderr)) {
        throw new CliError('NOT_LINKED', stderr);
    }
    const summary = stderr || `${cmd} exited with code ${result.exitCode}`;
    logger.log(`${cmd} ${args.join(' ')} failed: ${summary}`);
    throw new CliError('OTHER', stderr, summary);
}
