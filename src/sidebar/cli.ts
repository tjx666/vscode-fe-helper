import * as process from 'node:process';

import { execa } from 'execa';

import { logger, logTiming } from '../utils/log';

export type CliErrorKind =
    | 'NOT_LOGGED_IN'
    | 'NOT_LINKED'
    | 'RATE_LIMITED'
    | 'TIMEOUT'
    | 'NOT_FOUND'
    | 'OTHER';

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

type SupportedCli = 'gh' | 'linear' | 'vc';

export type RunCli = (
    cmd: SupportedCli,
    args: string[],
    cwd: string,
    logContext?: string,
) => Promise<string>;

export async function runCli(
    cmd: SupportedCli,
    args: string[],
    cwd: string,
    logContext?: string,
): Promise<string> {
    const start = Date.now();
    const argSummary = summarizeArgs(cmd, args, logContext);
    const result = await execa(cmd, args, {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        reject: false,
        // CI=1 forces non-interactive output and makes vc skip its TTY prompt.
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
        logger.log(`${cmd} ${argSummary} failed: ${summary}`);
        throw new CliError('OTHER', stderr, summary);
    }
    throw buildCliError(kind, cmd, stderr);
}

export function classifyCliError(
    err: { code?: string; timedOut?: boolean },
    stderr: string,
): CliErrorKind {
    if (err.code === 'ENOENT') return 'NOT_FOUND';
    if (err.timedOut) return 'TIMEOUT';
    if (
        /api rate limit (?:already )?exceeded|rate limit exceeded|secondary rate limit|abuse detection/i.test(
            stderr,
        )
    ) {
        return 'RATE_LIMITED';
    }
    if (
        /auth(?:entication)? required|please run.*auth login|not logged in|login required|no api key|linear auth login/i.test(
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
    cmd: SupportedCli,
    stderr: string,
): CliError {
    switch (kind) {
        case 'NOT_FOUND':
            return new CliError('NOT_FOUND', '', `${cmd} not installed`);
        case 'TIMEOUT':
            return new CliError('TIMEOUT', stderr, `${cmd} timed out`);
        case 'RATE_LIMITED':
            return new CliError('RATE_LIMITED', stderr, `${cmd} API rate limited`);
        case 'NOT_LOGGED_IN':
            return new CliError('NOT_LOGGED_IN', stderr);
        case 'NOT_LINKED':
            return new CliError('NOT_LINKED', stderr);
    }
}

/** Command path plus safe request context — enough to grep without logging query bodies or secrets. */
function summarizeArgs(cmd: SupportedCli, args: string[], logContext?: string): string {
    const commandPath =
        cmd === 'gh' ? args.slice(0, 2).join(' ') : (args.find((a) => !a.startsWith('-')) ?? '');
    const meta: string[] = [];
    let env: string | undefined;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--meta' && args[i + 1]) meta.push(args[i + 1]);
        else if (args[i] === '--environment' && args[i + 1]) env = args[i + 1];
    }
    const envSuffix = env ? ` env=${env}` : '';
    const metaSuffix = meta.length > 0 ? ` meta=[${meta.join(',')}]` : '';
    const contextSuffix = logContext ? ` ${logContext}` : '';
    return `${commandPath}${envSuffix}${metaSuffix}${contextSuffix}`;
}
