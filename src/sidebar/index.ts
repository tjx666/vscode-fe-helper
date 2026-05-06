import vscode from 'vscode';

import { getRepoContexts } from './gitContext';
import { activatePrStatusBar } from './prStatusBar';
import { Scheduler } from './scheduler';
import { CONFIG_SECTION, ProjectStatusProvider, VIEW_ID } from './tree';
import { initVercelLink, resetVercelLinkCache } from './vercelLink';

export async function activateSidebar(context: vscode.ExtensionContext): Promise<void> {
    initVercelLink(context.globalState);

    const provider = new ProjectStatusProvider();
    const treeView = vscode.window.createTreeView(VIEW_ID, {
        treeDataProvider: provider,
        showCollapseAll: true,
    });
    provider.setTreeView(treeView);

    const session = new SidebarSession(provider);
    await session.start();

    context.subscriptions.push(
        treeView,
        provider,
        session,
        activatePrStatusBar(provider),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(CONFIG_SECTION)) session.restart();
        }),
        vscode.commands.registerCommand('VSCodeFEHelper.projectStatus.refresh', () =>
            provider.refresh(),
        ),
        vscode.commands.registerCommand(
            'VSCodeFEHelper.projectStatus.resetVercelCache',
            async () => {
                await resetVercelLinkCache();
                await provider.refresh();
                vscode.window.showInformationMessage('FE Helper: Vercel team cache cleared.');
            },
        ),
    );
}

class SidebarSession implements vscode.Disposable {
    private scheduler: Scheduler | undefined;
    private branchWatcher: vscode.FileSystemWatcher | undefined;
    private branchDebounce: NodeJS.Timeout | undefined;

    constructor(private readonly provider: ProjectStatusProvider) {}

    async start(): Promise<void> {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const interval = config.get<number>('refreshInterval', 30_000);

        this.scheduler = new Scheduler();
        this.scheduler.setInterval(interval);
        this.scheduler.onTick(() => this.provider.refresh());
        this.scheduler.start();

        this.installBranchWatcher();
    }

    private installBranchWatcher(): void {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return;

        this.branchWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '.git/HEAD'),
        );
        /**
         * git rewrites HEAD on every fetch/commit/checkout (often in bursts),
         * so coalesce events into a single re-read.
         */
        const handler = () => {
            if (this.branchDebounce) clearTimeout(this.branchDebounce);
            this.branchDebounce = setTimeout(async () => {
                this.branchDebounce = undefined;
                const fresh = await getRepoContexts();
                if (fresh.length === 0) return;
                this.scheduler?.triggerNow();
            }, 500);
        };
        this.branchWatcher.onDidChange(handler);
        this.branchWatcher.onDidCreate(handler);
    }

    async restart(): Promise<void> {
        this.disposeRuntime();
        await this.start();
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
