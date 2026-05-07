import os from 'node:os';

import vscode from 'vscode';

import { runCli } from '../sidebar/cli';
import { githubBranchUrl, githubRepoUrl, parseVcList, safeJsonParse } from '../sidebar/common';
import type { RepoContext } from '../sidebar/gitContext';
import { getRepoContexts } from '../sidebar/gitContext';
import { findVercelTeam } from '../sidebar/vercelLink';

interface Choice extends vscode.QuickPickItem {
    url: string;
}

export async function openWebsites(): Promise<void> {
    const repos = await getRepoContexts();
    if (repos.length === 0) {
        vscode.window.showInformationMessage('No git repository found in workspace.');
        return;
    }

    const items = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: 'FE Helper: collecting URLs...',
        },
        () => buildItems(repos),
    );

    if (items.length === 0) {
        vscode.window.showWarningMessage('No URLs available for the current workspace.');
        return;
    }

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Pick a URL to open',
        matchOnDescription: true,
        matchOnDetail: true,
    });
    if (!picked) return;
    await vscode.env.openExternal(vscode.Uri.parse(picked.url));
}

async function buildItems(repos: RepoContext[]): Promise<Choice[]> {
    const groups = await Promise.all(repos.map((ctx) => collectForRepo(ctx)));
    // Float PRs across all repos to the top (main repo first, then submodules
    // in .gitmodules order); within each repo the rest stays grouped.
    return [...groups.flatMap((g) => (g.pr ? [g.pr] : [])), ...groups.flatMap((g) => g.others)];
}

async function collectForRepo(ctx: RepoContext): Promise<{ pr?: Choice; others: Choice[] }> {
    const others: Choice[] = [];
    const repoLabel = ctx.repo ?? ctx.label;
    const groupHint = ctx.isSubmodule ? `submodule · ${ctx.label}` : repoLabel;

    if (ctx.owner && ctx.repo) {
        const url = githubRepoUrl(ctx.owner, ctx.repo);
        others.push({
            label: `$(repo) ${repoLabel}`,
            description: groupHint,
            detail: url,
            url,
        });
    }

    if (ctx.owner && ctx.repo && ctx.branch) {
        const url = githubBranchUrl(ctx.owner, ctx.repo, ctx.branch);
        others.push({
            label: `$(git-branch) ${ctx.branch}`,
            description: groupHint,
            detail: url,
            url,
        });
    }

    const [prInfo, vercelUrl] = await Promise.all([fetchPrInfo(ctx), fetchVercelProjectUrl(ctx)]);

    if (vercelUrl) {
        others.push({
            label: `$(rocket) Vercel deployments`,
            description: groupHint,
            detail: vercelUrl,
            url: vercelUrl,
        });
    }

    const pr: Choice | undefined = prInfo
        ? {
              label: `$(git-pull-request) #${prInfo.number} ${prInfo.title}`,
              description: groupHint,
              detail: prInfo.url,
              url: prInfo.url,
          }
        : undefined;

    return { pr, others };
}

interface PrInfo {
    url: string;
    number: number;
    title: string;
}

async function fetchPrInfo(ctx: RepoContext): Promise<PrInfo | undefined> {
    if (!ctx.owner || !ctx.repo || !ctx.branch) return undefined;
    try {
        const stdout = await runCli(
            'gh',
            [
                'pr',
                'list',
                '--head',
                ctx.branch,
                '--state',
                'open',
                '--author',
                '@me',
                '--json',
                'url,number,title',
                '--limit',
                '1',
            ],
            ctx.rootPath,
        );
        const prs = safeJsonParse<PrInfo[]>(stdout, []);
        return prs[0];
    } catch {
        return undefined;
    }
}

async function fetchVercelProjectUrl(ctx: RepoContext): Promise<string | undefined> {
    if (!ctx.owner || !ctx.repo) return undefined;
    try {
        const team = await findVercelTeam(ctx.owner, ctx.repo);
        if (!team) return undefined;
        const stdout = await runCli(
            'vc',
            [
                'ls',
                '--format',
                'json',
                '--scope',
                team,
                '--meta',
                `githubOrg=${ctx.owner}`,
                '--meta',
                `githubRepo=${ctx.repo}`,
                '--yes',
            ],
            os.homedir(),
        );
        const list = parseVcList<{ name?: string }>(stdout);
        const projectName = list[0]?.name;
        if (!projectName) return undefined;
        return `https://vercel.com/${team}/${projectName}/deployments`;
    } catch {
        return undefined;
    }
}
