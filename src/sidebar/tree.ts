import os from 'node:os';

import vscode from 'vscode';

import { logTiming } from '../utils/log';
import type { CliErrorKind } from './cli';
import { CliError, runCli } from './cli';
import {
    buildMarkdownTooltip,
    errorHint,
    errorLabel,
    githubBranchUrl,
    matchAnyGlob,
    parseVcList,
    safeJsonParse,
    vcLsArgs,
    vercelDeploymentsUrl,
    vercelInspectorUrl,
} from './common';
import type { RepoContext } from './gitContext';
import { getRepoContexts } from './gitContext';
import type { ReviewThreadEntry } from './reviewThreads';
import { fetchUnresolvedThreads } from './reviewThreads';
import { findVercelLink } from './vercelLink';

interface CheckEntry {
    name?: string;
    context?: string;
    workflowName?: string;
    conclusion?: string | null;
    state?: string | null;
    status?: string | null;
    detailsUrl?: string;
    targetUrl?: string;
    startedAt?: string | null;
    completedAt?: string | null;
}

interface PrEntry {
    number: number;
    url: string;
    title: string;
    statusCheckRollup?: CheckEntry[];
}

interface VcDeployment {
    url: string;
    name?: string;
    state?: string;
    readyState?: string;
    target?: 'production' | 'preview' | null;
    created?: number;
}

type CiAggregate = 'success' | 'failure' | 'pending';
type DeploymentStatus = 'queue' | 'building' | 'success' | 'failed';

interface RepoState {
    ctx: RepoContext;
    pr?: PrEntry;
    ci?: CiAggregate;
    visibleChecks?: CheckEntry[];
    hiddenCheckCount?: number;
    unresolvedThreads?: ReviewThreadEntry[];
    prod?: VcDeployment;
    preview?: VcDeployment;
    branchDeployments?: VcDeployment[];
    vercelTeam?: string;
    vercelProject?: string;
    ghChecked?: boolean;
    vcChecked?: boolean;
    ghError?: { kind: CliErrorKind };
    vcError?: { kind: CliErrorKind };
}

export interface RepoStateSnapshot {
    ctx: RepoContext;
    pr?: { number: number; url: string; title: string };
    vercelTeam?: string;
    vercelProject?: string;
    ghChecked: boolean;
    vcChecked: boolean;
}

export type SidebarNode =
    | { kind: 'repo'; rootPath: string }
    | { kind: 'pr'; rootPath: string }
    | { kind: 'check'; rootPath: string; idx: number }
    | { kind: 'hiddenChecks'; rootPath: string }
    | { kind: 'reviewThreads'; rootPath: string }
    | { kind: 'reviewThread'; rootPath: string; idx: number }
    | { kind: 'branch'; rootPath: string }
    | { kind: 'deployments'; rootPath: string }
    | { kind: 'branchDeployment'; rootPath: string; idx: number }
    | { kind: 'deployment'; rootPath: string; env: 'production' | 'preview' }
    | { kind: 'error'; rootPath: string; source: 'gh' | 'vc' }
    | { kind: 'placeholder'; text: string; busy?: boolean };

export interface OpenPrSummary {
    rootPath: string;
    /** Display label: GitHub repo name, falls back to context label (e.g. submodule path). */
    label: string;
    branch: string;
    number: number;
    url: string;
    title: string;
    ci?: 'success' | 'failure' | 'pending';
}

const FAILURE_CONCLUSIONS = new Set([
    'failure',
    'failed',
    'cancelled',
    'timed_out',
    'action_required',
    'startup_failure',
    'error',
]);

const SUCCESS_CONCLUSIONS = new Set(['success', 'neutral', 'skipped', 'completed']);

const PENDING_STATUSES = new Set(['in_progress', 'queued', 'pending']);

export const CONFIG_SECTION = 'vscode-fe-helper.projectStatus';
export const VIEW_ID = 'vscodeFeHelperProjectStatus';

export class ProjectStatusProvider implements vscode.TreeDataProvider<SidebarNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<SidebarNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private cache = new Map<string, RepoState>();
    private order: string[] = [];
    private loaded = false;
    private treeView: vscode.TreeView<SidebarNode> | undefined;
    private inFlight: Promise<void> | undefined;
    private pendingRefresh = false;

    setTreeView(view: vscode.TreeView<SidebarNode>): void {
        this.treeView = view;
        this.updateBadge();
    }

    /**
     * Single-flight + trailing: at most one fetch runs at a time. Calls that arrive while one is in
     * flight collapse into a single trailing run, so a slow refresh can't clobber a newer one's
     * result.
     */
    async refresh(): Promise<void> {
        if (this.inFlight) {
            this.pendingRefresh = true;
            await this.inFlight;
            return;
        }
        const run = this.runRefresh();
        this.inFlight = run;
        try {
            await run;
        } finally {
            this.inFlight = undefined;
        }
        if (this.pendingRefresh) {
            this.pendingRefresh = false;
            await this.refresh();
        }
    }

    private async runRefresh(): Promise<void> {
        const start = Date.now();
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const ghEnabled = config.get<boolean>('github.enabled', false);
        const vcEnabled = config.get<boolean>('vercel.enabled', false);
        const ignoredChecks = config.get<string[]>('ignoredChecks', []);

        if (!ghEnabled && !vcEnabled) {
            this.cache.clear();
            this.order = [];
            this.loaded = true;
            this.updateBadge();
            // eslint-disable-next-line unicorn/no-useless-undefined
            this._onDidChangeTreeData.fire(undefined);
            logTiming('sidebar.refresh', start, 'disabled');
            return;
        }

        const repos = await getRepoContexts();
        const newCache = new Map<string, RepoState>();

        await Promise.all(
            repos.map(async (ctx) => {
                const state: RepoState = { ctx };
                await Promise.all([
                    ghEnabled ? this.fetchGitHub(ctx, state, ignoredChecks) : Promise.resolve(),
                    vcEnabled ? this.fetchVercel(ctx, state) : Promise.resolve(),
                ]);
                newCache.set(ctx.rootPath, state);
            }),
        );

        this.order = repos.map((c) => c.rootPath);
        this.cache = newCache;
        this.loaded = true;
        this.updateBadge();
        // eslint-disable-next-line unicorn/no-useless-undefined
        this._onDidChangeTreeData.fire(undefined);
        logTiming(
            'sidebar.refresh',
            start,
            `repos=${repos.length} gh=${ghEnabled} vc=${vcEnabled}`,
        );
    }

    private async fetchGitHub(
        ctx: RepoContext,
        state: RepoState,
        ignored: string[],
    ): Promise<void> {
        if (!ctx.owner || !ctx.repo || !ctx.branch) return;
        state.ghChecked = true;
        const start = Date.now();
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
                    'number,url,title,statusCheckRollup',
                    '--limit',
                    '1',
                ],
                ctx.rootPath,
            );
            const prs = safeJsonParse<PrEntry[]>(stdout, []);
            if (prs.length === 0) {
                logTiming(`sidebar.gh ${ctx.label}`, start, 'no pr');
                return;
            }
            const pr = prs[0];
            const checks = pr.statusCheckRollup ?? [];
            const visible = checks.filter((c) => !isIgnored(c, ignored));
            state.pr = pr;
            state.ci = aggregateCi(visible);
            state.visibleChecks = visible.slice().sort(checkSort);
            state.hiddenCheckCount = checks.length - visible.length;
            state.unresolvedThreads = await fetchUnresolvedThreads(ctx, pr.number);
            logTiming(
                `sidebar.gh ${ctx.label}`,
                start,
                `pr=#${pr.number} checks=${visible.length}+${state.hiddenCheckCount} ci=${state.ci} unresolved=${state.unresolvedThreads.length}`,
            );
        } catch (error) {
            const kind = error instanceof CliError ? error.kind : 'OTHER';
            state.ghError = { kind };
            logTiming(`sidebar.gh ${ctx.label}`, start, `error=${kind}`);
        }
    }

    private async fetchVercel(ctx: RepoContext, state: RepoState): Promise<void> {
        if (!ctx.owner || !ctx.repo) return;
        state.vcChecked = true;
        const start = Date.now();
        try {
            const link = await findVercelLink(ctx.owner, ctx.repo);
            if (!link) {
                logTiming(`sidebar.vc ${ctx.label}`, start, 'no link');
                return;
            }
            state.vercelTeam = link.team;
            state.vercelProject = link.project;
            const tasks: Array<Promise<unknown>> = [
                fetchLatestProduction(link.team, ctx.owner, ctx.repo).then((d) => {
                    state.prod = d;
                }),
            ];
            if (ctx.headSha) {
                tasks.push(
                    fetchPreviewForCommit(link.team, ctx.headSha).then((d) => {
                        state.preview = d;
                    }),
                );
            }
            if (ctx.branch) {
                tasks.push(
                    fetchBranchDeployments(link.team, ctx.owner, ctx.repo, ctx.branch).then(
                        (list) => {
                            state.branchDeployments = list;
                        },
                    ),
                );
            }
            await Promise.all(tasks);
            logTiming(
                `sidebar.vc ${ctx.label}`,
                start,
                `${link.team}/${link.project} prod=${state.prod ? (statusOf(state.prod) ?? '?') : 'none'} preview=${state.preview ? (statusOf(state.preview) ?? '?') : 'none'} branch=${state.branchDeployments?.length ?? 0}`,
            );
        } catch (error) {
            const kind = error instanceof CliError ? error.kind : 'OTHER';
            state.vcError = { kind };
            logTiming(`sidebar.vc ${ctx.label}`, start, `error=${kind}`);
        }
    }

    getRepoSnapshot(rootPath: string): RepoStateSnapshot | undefined {
        const s = this.cache.get(rootPath);
        if (!s) return undefined;
        return {
            ctx: s.ctx,
            pr: s.pr ? { number: s.pr.number, url: s.pr.url, title: s.pr.title } : undefined,
            vercelTeam: s.vercelTeam,
            vercelProject: s.vercelProject,
            ghChecked: s.ghChecked ?? false,
            vcChecked: s.vcChecked ?? false,
        };
    }

    getOpenPrs(): OpenPrSummary[] {
        const result: OpenPrSummary[] = [];
        for (const rootPath of this.order) {
            const state = this.cache.get(rootPath);
            if (!state?.pr) continue;
            result.push({
                rootPath,
                label: state.ctx.repo ?? state.ctx.label,
                branch: state.ctx.branch ?? '',
                number: state.pr.number,
                url: state.pr.url,
                title: state.pr.title,
                ci: state.ci,
            });
        }
        return result;
    }

    private updateBadge(): void {
        if (!this.treeView) return;
        let alerts = 0;
        let unresolved = 0;
        for (const state of this.cache.values()) {
            if (state.ci === 'failure') alerts++;
            if (statusOf(state.prod) === 'failed') alerts++;
            if (statusOf(state.preview) === 'failed') alerts++;
            unresolved += state.unresolvedThreads?.length ?? 0;
        }
        const total = alerts + unresolved;
        if (total === 0) {
            this.treeView.badge = undefined;
            return;
        }
        const parts: string[] = [];
        if (alerts > 0) parts.push(`${alerts} alert${alerts === 1 ? '' : 's'}`);
        if (unresolved > 0) {
            parts.push(`${unresolved} unresolved comment${unresolved === 1 ? '' : 's'}`);
        }
        this.treeView.badge = { value: total, tooltip: parts.join(' · ') };
    }

    getTreeItem(node: SidebarNode): vscode.TreeItem {
        switch (node.kind) {
            case 'placeholder':
                return placeholderItem(node);
            case 'repo':
                return this.repoItem(node.rootPath);
            case 'pr':
                return this.prItem(node.rootPath);
            case 'check':
                return this.checkItem(node.rootPath, node.idx);
            case 'hiddenChecks':
                return this.hiddenChecksItem(node.rootPath);
            case 'reviewThreads':
                return this.reviewThreadsItem(node.rootPath);
            case 'reviewThread':
                return this.reviewThreadItem(node.rootPath, node.idx);
            case 'branch':
                return this.branchItem(node.rootPath);
            case 'deployments':
                return this.deploymentsItem(node.rootPath);
            case 'branchDeployment':
                return this.branchDeploymentItem(node.rootPath, node.idx);
            case 'deployment':
                return this.deploymentItem(node.rootPath, node.env);
            case 'error':
                return this.errorItem(node.rootPath, node.source);
        }
    }

    async getChildren(node?: SidebarNode): Promise<SidebarNode[]> {
        if (!node) {
            if (!this.loaded) return [{ kind: 'placeholder', text: 'Loading…', busy: true }];
            return this.order.map((rootPath) => ({ kind: 'repo' as const, rootPath }));
        }

        const state = node.kind !== 'placeholder' ? this.cache.get(node.rootPath) : undefined;
        if (!state) return [];

        if (node.kind === 'repo') {
            const children: SidebarNode[] = [];
            children.push({ kind: 'branch', rootPath: node.rootPath });
            if (state.vercelProject) {
                children.push({ kind: 'deployments', rootPath: node.rootPath });
            }
            if ((state.unresolvedThreads?.length ?? 0) > 0) {
                children.push({ kind: 'reviewThreads', rootPath: node.rootPath });
            }
            if (state.prod) {
                children.push({ kind: 'deployment', rootPath: node.rootPath, env: 'production' });
            }
            if (state.preview) {
                children.push({ kind: 'deployment', rootPath: node.rootPath, env: 'preview' });
            }
            if (state.pr) children.push({ kind: 'pr', rootPath: node.rootPath });
            if (state.vcError)
                children.push({ kind: 'error', rootPath: node.rootPath, source: 'vc' });
            if (state.ghError)
                children.push({ kind: 'error', rootPath: node.rootPath, source: 'gh' });
            return children;
        }

        if (node.kind === 'pr') {
            const checks = state.visibleChecks ?? [];
            const items: SidebarNode[] = checks.map((_, idx) => ({
                kind: 'check' as const,
                rootPath: node.rootPath,
                idx,
            }));
            if ((state.hiddenCheckCount ?? 0) > 0) {
                items.push({ kind: 'hiddenChecks', rootPath: node.rootPath });
            }
            return items;
        }

        if (node.kind === 'deployments') {
            const deps = state.branchDeployments ?? [];
            return deps.map((_, idx) => ({
                kind: 'branchDeployment' as const,
                rootPath: node.rootPath,
                idx,
            }));
        }

        if (node.kind === 'reviewThreads') {
            const threads = state.unresolvedThreads ?? [];
            return threads.map((_, idx) => ({
                kind: 'reviewThread' as const,
                rootPath: node.rootPath,
                idx,
            }));
        }

        return [];
    }

    private repoItem(rootPath: string): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const ctx = state.ctx;
        const name = ctx.repo ?? ctx.label;
        const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.Expanded);
        item.id = `repo:${rootPath}`;
        item.iconPath = ctx.isSubmodule
            ? new vscode.ThemeIcon('file-submodule')
            : new vscode.ThemeIcon('repo');
        item.description = ctx.isSubmodule ? ctx.label : undefined;
        item.contextValue = 'projectStatus.repo';
        item.tooltip = buildMarkdownTooltip((md) => {
            md.appendMarkdown(`**${ctx.owner}/${ctx.repo}**\n\n`);
            md.appendMarkdown(`- branch: \`${ctx.branch ?? '?'}\`\n`);
            if (ctx.headSha) md.appendMarkdown(`- HEAD: \`${ctx.headSha.slice(0, 7)}\`\n`);
            if (ctx.isSubmodule) md.appendMarkdown(`- submodule path: \`${ctx.label}\`\n`);
        });
        return item;
    }

    private prItem(rootPath: string): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const pr = state.pr!;
        const initialState =
            state.ci === 'failure'
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;
        const item = new vscode.TreeItem(`#${pr.number} ${pr.title}`, initialState);
        item.id = `pr:${rootPath}`;
        item.iconPath = ciThemeIcon(state.ci);
        item.description = state.ci ?? undefined;
        item.contextValue = 'projectStatus.pr';
        item.command = openUrlCommand(pr.url);
        item.tooltip = buildMarkdownTooltip((md) => {
            md.appendMarkdown(`[#${pr.number}](${pr.url}) — ${pr.title}\n`);
        });
        return item;
    }

    private checkItem(rootPath: string, idx: number): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const c = state.visibleChecks?.[idx];
        if (!c) {
            const item = new vscode.TreeItem('?', vscode.TreeItemCollapsibleState.None);
            item.id = `check:${rootPath}:${idx}`;
            return item;
        }
        const name = c.workflowName
            ? `${c.workflowName} / ${c.name ?? c.context ?? '?'}`
            : (c.name ?? c.context ?? '?');
        const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.None);
        item.id = `check:${rootPath}:${idx}`;
        item.iconPath = checkThemeIcon(c);
        item.description = checkDescription(c);
        item.contextValue = 'projectStatus.check';
        const url = c.detailsUrl ?? c.targetUrl;
        if (url) item.command = openUrlCommand(url);
        return item;
    }

    private hiddenChecksItem(rootPath: string): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const n = state.hiddenCheckCount ?? 0;
        const item = new vscode.TreeItem(
            `${n} ignored check${n === 1 ? '' : 's'} hidden`,
            vscode.TreeItemCollapsibleState.None,
        );
        item.id = `hiddenChecks:${rootPath}`;
        item.iconPath = new vscode.ThemeIcon('eye-closed');
        item.tooltip = 'Hidden by `vscode-fe-helper.projectStatus.ignoredChecks`.';
        return item;
    }

    private reviewThreadsItem(rootPath: string): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const threads = state.unresolvedThreads ?? [];
        const n = threads.length;
        const item = new vscode.TreeItem(
            'Unresolved Comments',
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        item.id = `reviewThreads:${rootPath}`;
        item.iconPath = new vscode.ThemeIcon(
            'comment-unresolved',
            new vscode.ThemeColor('charts.yellow'),
        );
        item.description = String(n);
        item.contextValue = 'projectStatus.reviewThreads';
        item.command = openUrlCommand(state.pr!.url);
        item.tooltip = buildMarkdownTooltip((md) => {
            md.appendMarkdown(`**${n} unresolved review thread${n === 1 ? '' : 's'}**\n\n`);
            md.appendMarkdown('Click to open the PR conversation; expand for individual threads.');
        });
        return item;
    }

    private reviewThreadItem(rootPath: string, idx: number): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const t = state.unresolvedThreads?.[idx];
        if (!t) {
            const item = new vscode.TreeItem('?', vscode.TreeItemCollapsibleState.None);
            item.id = `reviewThread:${rootPath}:${idx}`;
            return item;
        }
        const location = formatThreadLocation(t.path, t.line);
        const item = new vscode.TreeItem(location, vscode.TreeItemCollapsibleState.None);
        item.id = `reviewThread:${rootPath}:${idx}`;
        item.iconPath = new vscode.ThemeIcon('comment');
        item.description = oneLine(t.body, 80);
        item.contextValue = 'projectStatus.reviewThread';
        item.command = openUrlCommand(t.url);
        item.tooltip = buildMarkdownTooltip((md) => {
            const author = t.author ? `@${t.author}` : 'unknown';
            const when = t.createdAt ? ` · ${new Date(t.createdAt).toLocaleString()}` : '';
            md.appendMarkdown(`**${author}**${when}\n\n`);
            if (t.path) {
                md.appendMarkdown(`\`${t.path}${t.line != null ? `:${t.line}` : ''}\`\n\n`);
            }
            md.appendMarkdown(t.body || '_(empty)_');
        });
        return item;
    }

    private branchItem(rootPath: string): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const ctx = state.ctx;
        const item = new vscode.TreeItem(ctx.branch ?? '?', vscode.TreeItemCollapsibleState.None);
        item.id = `branch:${rootPath}`;
        item.iconPath = new vscode.ThemeIcon('git-branch');
        item.description = ctx.branch && ctx.branch === ctx.defaultBranch ? 'default' : undefined;
        item.contextValue = 'projectStatus.branch';
        if (ctx.owner && ctx.repo && ctx.branch) {
            item.command = openUrlCommand(githubBranchUrl(ctx.owner, ctx.repo, ctx.branch));
        }
        return item;
    }

    private deploymentsItem(rootPath: string): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const ctx = state.ctx;
        const deps = state.branchDeployments ?? [];
        const collapsibleState =
            deps.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;
        const item = new vscode.TreeItem('Deployments', collapsibleState);
        item.id = `deployments:${rootPath}`;
        item.iconPath = new vscode.ThemeIcon('list-unordered');
        item.description = ctx.branch ? `${deps.length} on ${ctx.branch}` : `${deps.length}`;
        item.contextValue = 'projectStatus.deployments';
        if (state.vercelTeam && state.vercelProject) {
            item.command = openUrlCommand(
                vercelDeploymentsUrl(state.vercelTeam, state.vercelProject, ctx.branch),
            );
        }
        item.tooltip = buildMarkdownTooltip((md) => {
            md.appendMarkdown(`**Deployments** · branch \`${ctx.branch ?? '?'}\`\n\n`);
            md.appendMarkdown(
                `Click to open the Vercel deployments page; expand for the latest ${deps.length} on this branch.`,
            );
        });
        return item;
    }

    private branchDeploymentItem(rootPath: string, idx: number): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const dep = state.branchDeployments?.[idx];
        if (!dep) {
            const item = new vscode.TreeItem('?', vscode.TreeItemCollapsibleState.None);
            item.id = `branchDep:${rootPath}:${idx}`;
            return item;
        }
        const status = statusOf(dep) ?? 'unknown';
        const target = dep.target ?? 'preview';
        const inspector =
            state.vercelTeam && state.vercelProject
                ? vercelInspectorUrl(state.vercelTeam, state.vercelProject, dep.url)
                : undefined;
        const item = new vscode.TreeItem(dep.url, vscode.TreeItemCollapsibleState.None);
        item.id = `branchDep:${rootPath}:${idx}`;
        item.iconPath = depThemeIcon(dep);
        item.description = `${target} · ${status}`;
        item.contextValue = 'projectStatus.branchDeployment';
        item.command = openUrlCommand(
            deploymentOpenUrl(dep, state.vercelTeam, state.vercelProject),
        );
        item.tooltip = buildMarkdownTooltip((md) => {
            md.appendMarkdown(`**${target}** · \`${status}\`\n\n`);
            md.appendMarkdown(`- alias: [${dep.url}](https://${dep.url})\n`);
            if (inspector) md.appendMarkdown(`- inspect: [logs](${inspector})\n`);
            if (dep.created) {
                md.appendMarkdown(`- created: ${new Date(dep.created).toLocaleString()}\n`);
            }
        });
        return item;
    }

    private deploymentItem(rootPath: string, env: 'production' | 'preview'): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const dep = env === 'production' ? state.prod! : state.preview!;
        const status = statusOf(dep) ?? 'unknown';
        const label = env === 'production' ? 'Production' : 'Preview';
        const inspector =
            state.vercelTeam && state.vercelProject
                ? vercelInspectorUrl(state.vercelTeam, state.vercelProject, dep.url)
                : undefined;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.id = `dep:${rootPath}:${env}`;
        item.iconPath = depThemeIcon(dep);
        item.description = `${status} · ${dep.url}`;
        item.contextValue = 'projectStatus.deployment';
        item.command = openUrlCommand(
            deploymentOpenUrl(dep, state.vercelTeam, state.vercelProject),
        );
        item.tooltip = buildMarkdownTooltip((md) => {
            md.appendMarkdown(`**${label}** · \`${status}\`\n\n`);
            md.appendMarkdown(`- alias: [${dep.url}](https://${dep.url})\n`);
            if (inspector) md.appendMarkdown(`- inspect: [logs](${inspector})\n`);
            if (dep.created) {
                md.appendMarkdown(`- created: ${new Date(dep.created).toLocaleString()}\n`);
            }
        });
        return item;
    }

    private errorItem(rootPath: string, source: 'gh' | 'vc'): vscode.TreeItem {
        const state = this.cache.get(rootPath)!;
        const err = source === 'gh' ? state.ghError! : state.vcError!;
        const item = new vscode.TreeItem(
            errorLabel(err.kind, source),
            vscode.TreeItemCollapsibleState.None,
        );
        item.id = `error:${rootPath}:${source}`;
        item.iconPath = new vscode.ThemeIcon(
            'warning',
            new vscode.ThemeColor('list.warningForeground'),
        );
        item.description = errorHint(err.kind, source);
        item.tooltip = buildMarkdownTooltip((md) => {
            md.appendMarkdown(`**${errorLabel(err.kind, source)}**\n\n`);
            md.appendMarkdown(errorHint(err.kind, source));
        });
        return item;
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}

function placeholderItem(node: {
    kind: 'placeholder';
    text: string;
    busy?: boolean;
}): vscode.TreeItem {
    const item = new vscode.TreeItem(node.text, vscode.TreeItemCollapsibleState.None);
    item.iconPath = node.busy ? new vscode.ThemeIcon('loading~spin') : new vscode.ThemeIcon('info');
    return item;
}

function isIgnored(c: CheckEntry, patterns: string[]): boolean {
    if (patterns.length === 0) return false;
    const candidates = [c.name, c.context, c.workflowName].filter(
        (s): s is string => typeof s === 'string' && s.length > 0,
    );
    return candidates.some((candidate) => matchAnyGlob(patterns, candidate));
}

function aggregateCi(checks: CheckEntry[]): CiAggregate {
    if (checks.length === 0) return 'pending';
    let pending = 0;
    let failure = 0;
    for (const c of checks) {
        const status = (c.status ?? '').toLowerCase();
        if (PENDING_STATUSES.has(status)) {
            pending++;
            continue;
        }
        const outcome = (c.conclusion ?? c.state ?? '').toLowerCase();
        if (FAILURE_CONCLUSIONS.has(outcome)) failure++;
        else if (outcome === 'pending' || outcome === 'expected') pending++;
    }
    if (failure > 0) return 'failure';
    if (pending > 0) return 'pending';
    return 'success';
}

function ciThemeIcon(c: CiAggregate | undefined): vscode.ThemeIcon {
    switch (c) {
        case 'success':
            return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
        case 'failure':
            return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        case 'pending':
            return new vscode.ThemeIcon('loading~spin');
        default:
            return new vscode.ThemeIcon('git-pull-request');
    }
}

function checkThemeIcon(c: CheckEntry): vscode.ThemeIcon {
    const status = (c.status ?? '').toLowerCase();
    if (PENDING_STATUSES.has(status)) return new vscode.ThemeIcon('loading~spin');
    const outcome = (c.conclusion ?? c.state ?? '').toLowerCase();
    if (SUCCESS_CONCLUSIONS.has(outcome))
        return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
    if (FAILURE_CONCLUSIONS.has(outcome))
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    return new vscode.ThemeIcon('circle-outline');
}

function checkDescription(c: CheckEntry): string | undefined {
    if (!c.completedAt || !c.startedAt) return undefined;
    const ms = new Date(c.completedAt).getTime() - new Date(c.startedAt).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return undefined;
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return rem === 0 ? `${min}m` : `${min}m ${rem}s`;
}

/** Failures bubble up; then pending; success last. Stable within each group. */
function checkSort(a: CheckEntry, b: CheckEntry): number {
    return rank(a) - rank(b);
}
function rank(c: CheckEntry): number {
    const status = (c.status ?? '').toLowerCase();
    if (PENDING_STATUSES.has(status)) return 1;
    const outcome = (c.conclusion ?? c.state ?? '').toLowerCase();
    if (FAILURE_CONCLUSIONS.has(outcome)) return 0;
    if (SUCCESS_CONCLUSIONS.has(outcome)) return 2;
    return 3;
}

function statusOf(d: VcDeployment | undefined): DeploymentStatus | undefined {
    if (!d) return undefined;
    const raw = (d.readyState ?? d.state ?? '').toUpperCase();
    if (raw === 'READY') return 'success';
    if (raw === 'ERROR' || raw === 'CANCELED') return 'failed';
    if (raw === 'BUILDING') return 'building';
    if (raw === 'QUEUED' || raw === 'INITIALIZING') return 'queue';
    return undefined;
}

/**
 * Where clicking a deployment node should navigate.
 *
 * Non-ready deployments (building, queued, failed) serve an error page or nothing at the deployed
 * alias, so we open the Vercel inspector instead. Only successful deployments open the live alias.
 */
function deploymentOpenUrl(
    dep: VcDeployment,
    team: string | undefined,
    project: string | undefined,
): string {
    const live = `https://${dep.url}`;
    if (statusOf(dep) === 'success' || !team || !project) return live;
    return vercelInspectorUrl(team, project, dep.url) ?? live;
}

function depThemeIcon(d: VcDeployment | undefined): vscode.ThemeIcon {
    switch (statusOf(d)) {
        case 'success':
            return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
        case 'failed':
            return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        case 'building':
            return new vscode.ThemeIcon('loading~spin');
        case 'queue':
            return new vscode.ThemeIcon('loading~spin');
        default:
            return new vscode.ThemeIcon('rocket');
    }
}

async function fetchPreviewForCommit(team: string, sha: string): Promise<VcDeployment | undefined> {
    const list = await listDeployments(team, {
        meta: { githubCommitSha: sha },
        environment: 'preview',
    });
    return list[0];
}

async function fetchLatestProduction(
    team: string,
    owner: string,
    repo: string,
): Promise<VcDeployment | undefined> {
    const list = await listDeployments(team, {
        meta: { githubOrg: owner, githubRepo: repo },
        environment: 'production',
    });
    return list[0];
}

async function fetchBranchDeployments(
    team: string,
    owner: string,
    repo: string,
    branch: string,
): Promise<VcDeployment[]> {
    const list = await listDeployments(team, {
        meta: { githubOrg: owner, githubRepo: repo, githubCommitRef: branch },
    });
    return list.slice(0, 10);
}

async function listDeployments(
    team: string,
    opts: { meta?: Record<string, string>; environment?: 'production' | 'preview' },
): Promise<VcDeployment[]> {
    // Run from $HOME so vc doesn't try to read .vercel/project.json from a
    // workspace that may not have one — --scope pins the team explicitly.
    const stdout = await runCli('vc', vcLsArgs(team, opts), os.homedir());
    const list = parseVcList<VcDeployment>(stdout);
    list.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
    return list;
}

function openUrlCommand(url: string): vscode.Command {
    return {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.parse(url)],
    };
}

function oneLine(s: string, max: number): string {
    const collapsed = s.replaceAll(/\s+/g, ' ').trim();
    return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

function formatThreadLocation(path: string | undefined, line: number | null | undefined): string {
    if (!path) return 'general';
    return line == null ? path : `${path}:${line}`;
}
