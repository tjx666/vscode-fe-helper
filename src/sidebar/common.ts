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

export function buildMarkdownTooltip(
    builder: (md: vscode.MarkdownString) => void,
): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportThemeIcons = true;
    builder(md);
    return md;
}
