import vscode from 'vscode';

import type { CliErrorKind } from './cli';

export function errorLabel(kind: CliErrorKind, cli: 'gh' | 'vc'): string {
    switch (kind) {
        case 'NOT_LOGGED_IN':
            return cli === 'gh' ? 'gh: not logged in' : 'vc: not logged in';
        case 'NOT_FOUND':
            return `${cli} not installed`;
        case 'NOT_LINKED':
            return 'vc: not linked';
        case 'TIMEOUT':
            return `${cli} timed out`;
        default:
            return `${cli}: error`;
    }
}

export function errorHint(kind: CliErrorKind, cli: 'gh' | 'vc'): string {
    switch (kind) {
        case 'NOT_LOGGED_IN':
            return cli === 'gh'
                ? 'Run `gh auth login` in a terminal.'
                : 'Run `vc login` in a terminal.';
        case 'NOT_FOUND':
            return cli === 'gh'
                ? 'Install via https://cli.github.com/'
                : 'Install via `npm i -g vercel`.';
        case 'NOT_LINKED':
            return 'Run `vc link` inside the project to associate it with a Vercel project.';
        case 'TIMEOUT':
            return 'The CLI took too long to respond. Check your network / proxy settings.';
        default:
            return 'Unexpected CLI error. See the FE Helper output channel for details.';
    }
}

export function matchAnyGlob(patterns: string[], name: string): boolean {
    return patterns.some((p) => globToRegExp(p).test(name));
}

function globToRegExp(pattern: string): RegExp {
    const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`).replaceAll('*', '.*');
    return new RegExp(`^${escaped}$`);
}

export function safeJsonParse<T>(input: string, fallback: T): T {
    try {
        return JSON.parse(input) as T;
    } catch {
        return fallback;
    }
}

export function githubRepoUrl(owner: string, repo: string): string {
    return `https://github.com/${owner}/${repo}`;
}

export function githubBranchUrl(owner: string, repo: string, branch: string): string {
    return `${githubRepoUrl(owner, repo)}/tree/${encodeURIComponent(branch)}`;
}

/** Vercel's deployments page filters by branch via `?filterBranch=<name>`. */
export function vercelDeploymentsUrl(team: string, project: string, branch?: string): string {
    const base = `https://vercel.com/${team}/${project}/deployments`;
    return branch ? `${base}?filterBranch=${encodeURIComponent(branch)}` : base;
}

/**
 * Derive a deployment's Vercel inspector (build-logs) page URL from its canonical hostname.
 *
 * `vc ls --format json` never returns an inspector URL, but a deployment's host always follows
 * `<project>-<hash>-<team>.vercel.app`, and its inspector lives at
 * `https://vercel.com/<team>/<project>/<hash>`. Returns `undefined` when the host doesn't match
 * that shape (e.g. a custom alias) so callers can fall back to the live URL.
 */
export function vercelInspectorUrl(team: string, project: string, url: string): string | undefined {
    const host = url.replace(/^https?:\/\//, '').replace(/\.vercel\.app$/, '');
    const prefix = `${project}-`;
    const suffix = `-${team}`;
    if (!host.startsWith(prefix) || !host.endsWith(suffix)) return undefined;
    const hash = host.slice(prefix.length, host.length - suffix.length);
    if (!hash || hash.includes('.')) return undefined;
    return `https://vercel.com/${team}/${project}/${hash}`;
}

/** Build the canonical `vc ls` arg list. Centralized so query shape stays consistent. */
export function vcLsArgs(
    team: string,
    opts: { meta?: Record<string, string>; environment?: 'production' | 'preview' } = {},
): string[] {
    const args = ['ls', '--format', 'json', '--scope', team];
    for (const [k, v] of Object.entries(opts.meta ?? {})) {
        args.push('--meta', `${k}=${v}`);
    }
    if (opts.environment) args.push('--environment', opts.environment);
    args.push('--yes');
    return args;
}

/**
 * `vc ls --format json` returns either a bare array or `{ deployments: [...] }` depending on the
 * CLI version, so callers always need this fallback shape.
 */
export function parseVcList<T>(stdout: string): T[] {
    const data = safeJsonParse<T[] | { deployments?: T[] }>(stdout, []);
    return Array.isArray(data) ? data : (data.deployments ?? []);
}

export function buildMarkdownTooltip(
    builder: (md: vscode.MarkdownString) => void,
): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportThemeIcons = true;
    builder(md);
    return md;
}
