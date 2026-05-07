import * as process from 'node:process';

import { execa } from 'execa';

import { logger, logTiming } from '../utils/log';

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
    const start = Date.now();
    const argSummary = summarizeArgs(args);
    const result = await execa(cmd, args, {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        reject: false,
        // CI=1 forces vc to skip its TTY prompt; gh respects it too.
        env: { ...process.env, CI: '1' },
    });
    if (!result.failed) {
        logTiming(`cli.${cmd}`, start, `ok ${argSummary}`);
        return result.stdout;
    }

    const stderr = result.stderr ?? '';
    const err = result as { code?: string; timedOut?: boolean };
    const kind = classifyCliError(err, stderr);

    logTiming(`cli.${cmd}`, start, `fail=${kind} ${argSummary}`);

    if (kind === 'OTHER') {
        const summary = stderr || `${cmd} exited with code ${result.exitCode}`;
        logger.log(`${cmd} ${args.join(' ')} failed: ${summary}`);
        throw new CliError('OTHER', stderr, summary);
    }
    throw buildCliError(kind, cmd, stderr);
}

function classifyCliError(
    err: { code?: string; timedOut?: boolean },
    stderr: string,
): CliErrorKind {
    if (err.code === 'ENOENT') return 'NOT_FOUND';
    if (err.timedOut) return 'TIMEOUT';
    if (
        /auth(?:entication)? required|please run.*auth login|not logged in|login required/i.test(
            stderr,
        )
    ) {
        return 'NOT_LOGGED_IN';
    }
    if (/not linked|no project|please run.*link|link this directory/i.test(stderr)) {
        return 'NOT_LINKED';
    }
    return 'OTHER';
}

function buildCliError(
    kind: Exclude<CliErrorKind, 'OTHER'>,
    cmd: 'gh' | 'vc',
    stderr: string,
): CliError {
    switch (kind) {
        case 'NOT_FOUND':
            return new CliError('NOT_FOUND', '', `${cmd} not installed`);
        case 'TIMEOUT':
            return new CliError('TIMEOUT', stderr, `${cmd} timed out`);
        case 'NOT_LOGGED_IN':
            return new CliError('NOT_LOGGED_IN', stderr);
        case 'NOT_LINKED':
            return new CliError('NOT_LINKED', stderr);
    }
}

/** First non-flag positional + a hint of meta filters — enough to grep without leaking full args. */
function summarizeArgs(args: string[]): string {
    const positional = args.find((a) => !a.startsWith('-')) ?? '';
    const meta: string[] = [];
    let env: string | undefined;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--meta' && args[i + 1]) meta.push(args[i + 1]);
        else if (args[i] === '--environment' && args[i + 1]) env = args[i + 1];
    }
    const envSuffix = env ? ` env=${env}` : '';
    const metaSuffix = meta.length > 0 ? ` meta=[${meta.join(',')}]` : '';
    return `${positional}${envSuffix}${metaSuffix}`;
}
