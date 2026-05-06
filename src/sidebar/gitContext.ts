import fs from 'node:fs/promises';
import path from 'node:path';

import { execa } from 'execa';
import vscode from 'vscode';

export interface RepoContext {
    /** 'main' for the workspace root, otherwise the submodule path relative to the root */
    label: string;
    rootPath: string;
    isSubmodule: boolean;
    /** True when this badge should drop the submodule label from its rendered text. */
    compactLabel: boolean;
    owner?: string;
    repo?: string;
    branch?: string;
    headSha?: string;
    defaultBranch?: string;
}

export async function getRepoContexts(): Promise<RepoContext[]> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return [];

    const rootPath = folder.uri.fsPath;
    const main = await readRepoContext(rootPath, 'main', false);
    if (!main) return [];

    const submodules = await readSubmodules(rootPath);

    // Auto-compact when there's only one submodule — its name is redundant.
    const compactLabel = submodules.length === 1;
    for (const sub of submodules) sub.compactLabel = compactLabel;

    return [main, ...submodules];
}

async function readRepoContext(
    repoPath: string,
    label: string,
    isSubmodule: boolean,
): Promise<RepoContext | null> {
    const ctx: RepoContext = {
        label,
        rootPath: repoPath,
        isSubmodule,
        compactLabel: false,
    };

    const [remote, branch, sha, defaultBranch] = await Promise.all([
        runGit(['remote', 'get-url', 'origin'], repoPath).catch(() => ''),
        runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath).catch(() => ''),
        runGit(['rev-parse', 'HEAD'], repoPath).catch(() => ''),
        runGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], repoPath)
            .then((s) => s.replace(/^origin\//, ''))
            .catch(() => 'main'),
    ]);

    // Treat absence of any git data as "not a repo" — caller drops it.
    if (!remote && !branch && !sha) return null;

    const parsed = parseGitHubRemote(remote);
    if (parsed) {
        ctx.owner = parsed.owner;
        ctx.repo = parsed.repo;
    }
    if (branch) ctx.branch = branch;
    if (sha) ctx.headSha = sha;
    ctx.defaultBranch = defaultBranch || 'main';

    return ctx;
}

async function readSubmodules(repoPath: string): Promise<RepoContext[]> {
    let content: string;
    try {
        content = await fs.readFile(path.join(repoPath, '.gitmodules'), 'utf8');
    } catch {
        return [];
    }

    const paths: string[] = [];
    for (const match of content.matchAll(/^[\t ]*path[\t ]*=(.*)$/gm)) {
        const value = match[1].trim();
        if (value) paths.push(value);
    }

    const contexts = await Promise.all(
        paths.map((p) => readRepoContext(path.join(repoPath, p), p, true)),
    );
    return contexts.filter((c): c is RepoContext => c !== null);
}

function parseGitHubRemote(url: string): { owner: string; repo: string } | null {
    const trimmed = url.trim().replace(/\/$/, '').replace(/\.git$/, '');
    const m = trimmed.match(/github\.com[:/]([^/\s]+)\/([^/\s]+)$/);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
}

async function runGit(args: string[], cwd: string): Promise<string> {
    const { stdout } = await execa('git', args, { cwd, timeout: 5000 });
    return stdout.trim();
}
