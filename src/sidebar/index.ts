import vscode from 'vscode';

import { activatePrStatusBar } from './prStatusBar';
import type { RefreshReason } from './scheduler';
import { Scheduler } from './scheduler';
import {
    CONFIG_SECTION,
    OPEN_DEPLOYMENT_COMMAND,
    openVercelDeployment,
    ProjectStatusProvider,
    VIEW_ID,
} from './tree';
import { initVercelLink, resetVercelLinkCache } from './vercelLink';

let providerRef: ProjectStatusProvider | undefined;
const GITHUB_RATE_LIMIT_RESET_KEY = 'projectStatus.githubRateLimitResetAt';

/** Live ref to the sidebar's provider, so other commands (e.g. openWebsites) can read its cache. */
export function getProjectStatusProvider(): ProjectStatusProvider | undefined {
    return providerRef;
}

export async function activateSidebar(context: vscode.ExtensionContext): Promise<void> {
    initVercelLink(context.globalState);

    const provider = new ProjectStatusProvider({
        getGitHubRateLimitResetAt: () =>
            context.globalState.get<number>(GITHUB_RATE_LIMIT_RESET_KEY),
        setGitHubRateLimitResetAt: (resetAt) =>
            context.globalState.update(GITHUB_RATE_LIMIT_RESET_KEY, resetAt),
    });
    providerRef = provider;
    const treeView = vscode.window.createTreeView(VIEW_ID, {
        treeDataProvider: provider,
        showCollapseAll: true,
    });
    provider.setTreeView(treeView);

    const session = new SidebarSession(provider);
    session.start();

    context.subscriptions.push(
        treeView,
        provider,
        session,
        activatePrStatusBar(provider),
        { dispose: () => (providerRef = undefined) },
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(CONFIG_SECTION)) session.restart();
        }),
        vscode.commands.registerCommand('VSCodeFEHelper.projectStatus.refresh', () =>
            session.triggerNow('manual'),
        ),
        vscode.commands.registerCommand(
            'VSCodeFEHelper.projectStatus.resetVercelCache',
            async () => {
                await resetVercelLinkCache();
                await session.triggerNow('manual');
                vscode.window.showInformationMessage('FE Helper: Vercel team cache cleared.');
            },
        ),
        vscode.commands.registerCommand(OPEN_DEPLOYMENT_COMMAND, openVercelDeployment),
    );
}

class SidebarSession implements vscode.Disposable {
    private scheduler: Scheduler | undefined;
    private branchWatcher: vscode.FileSystemWatcher | undefined;
    private branchDebounce: NodeJS.Timeout | undefined;

    constructor(private readonly provider: ProjectStatusProvider) {}

    start(reason: Extract<RefreshReason, 'config' | 'startup'> = 'startup'): void {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const interval = config.get<number>('refreshInterval', 30_000);

        this.scheduler = new Scheduler(interval);
        this.scheduler.onTick((refreshReason) => this.provider.refresh(refreshReason, interval));
        this.scheduler.start(reason);

        this.installBranchWatcher();
    }

    triggerNow(reason: Extract<RefreshReason, 'branch' | 'manual'>): Promise<void> {
        return this.scheduler?.triggerNow(reason) ?? Promise.resolve();
    }

    private installBranchWatcher(): void {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return;

        this.branchWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '.git/HEAD'),
        );
        /**
         * Git rewrites HEAD on every fetch/commit/checkout (often in bursts), so coalesce events
         * into a single re-read.
         */
        const handler = () => {
            if (this.branchDebounce) clearTimeout(this.branchDebounce);
            this.branchDebounce = setTimeout(() => {
                this.branchDebounce = undefined;
                this.scheduler?.triggerNow('branch');
            }, 500);
        };
        this.branchWatcher.onDidChange(handler);
        this.branchWatcher.onDidCreate(handler);
    }

    restart(): void {
        this.disposeRuntime();
        this.start('config');
    }

    private disposeRuntime(): void {
        this.scheduler?.dispose();
        this.scheduler = undefined;
        this.branchWatcher?.dispose();
        this.branchWatcher = undefined;
        if (this.branchDebounce) {
            clearTimeout(this.branchDebounce);
            this.branchDebounce = undefined;
        }
    }

    dispose(): void {
        this.disposeRuntime();
    }
}
