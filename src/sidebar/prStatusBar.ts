import vscode from 'vscode';

import { buildMarkdownTooltip } from './common';
import { type ProjectStatusProvider, VIEW_ID } from './tree';

export function activatePrStatusBar(provider: ProjectStatusProvider): vscode.Disposable {
    const item = vscode.window.createStatusBarItem(
        'vscode-fe-helper.projectStatus.openPrs',
        vscode.StatusBarAlignment.Left,
        100,
    );
    item.name = 'FE Helper: Open PRs';

    const render = () => {
        const prs = provider.getOpenPrs();
        if (prs.length === 0) {
            item.hide();
            return;
        }

        if (prs.length === 1) {
            const pr = prs[0];
            item.text = `$(git-pull-request) #${pr.number}`;
            item.tooltip = buildMarkdownTooltip((md) => {
                md.appendMarkdown(`**${pr.label}** · \`${pr.branch}\`\n\n`);
                md.appendMarkdown(`[#${pr.number}](${pr.url}) — ${pr.title}\n`);
            });
            item.command = {
                command: 'vscode.open',
                title: 'Open PR',
                arguments: [vscode.Uri.parse(pr.url)],
            };
        } else {
            item.text = `$(git-pull-request) ${prs.length} PRs`;
            item.tooltip = buildMarkdownTooltip((md) => {
                md.appendMarkdown(`**${prs.length} open PRs**\n\n`);
                for (const pr of prs) {
                    md.appendMarkdown(
                        `- [#${pr.number}](${pr.url}) \`${pr.label}\` — ${pr.title}\n`,
                    );
                }
            });
            // Multi-PR: focus the sidebar so user can pick which one to act on.
            item.command = `${VIEW_ID}.focus`;
        }
        item.show();
    };

    render();
    const sub = provider.onDidChangeTreeData(() => render());
    return vscode.Disposable.from(item, sub);
}
