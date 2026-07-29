import { deepStrictEqual, match, ok, strictEqual } from 'node:assert';

import vscode from 'vscode';

import { CliError } from '../src/sidebar/cli';
import {
    DEFAULT_LINEAR_REFERENCE_MARKERS,
    extractLinearIssueReferences,
    resolveLinearIssue,
} from '../src/sidebar/linearIssue';
import { linearIssueIcon, linearStatusIconSvg } from '../src/sidebar/linearStatusIcon';
import type { SidebarNode } from '../src/sidebar/tree';
import { CONFIG_SECTION, ProjectStatusProvider } from '../src/sidebar/tree';

const DEFAULT_SCAN_OPTIONS = {
    markers: DEFAULT_LINEAR_REFERENCE_MARKERS,
    teamKeys: [],
};
const TEST_REPO_CONTEXT = {
    branch: 'feature/retries',
    isSubmodule: false,
    label: 'widgets',
    owner: 'acme',
    repo: 'widgets',
    rootPath: '/repo',
};

type TestRepoContext = typeof TEST_REPO_CONTEXT;
interface TestPullRequestOptions {
    githubEnabled: boolean;
    ignoredChecks: string[];
    linearEnabled: boolean;
    linearScan: typeof DEFAULT_SCAN_OPTIONS;
}
type FetchGitHubForTest = (
    ctx: TestRepoContext,
    state: Record<string, unknown>,
    options: TestPullRequestOptions,
    previous?: Record<string, unknown>,
) => Promise<void>;

describe('#extractLinearIssueReferences', () => {
    it('extracts a closing reference without treating other bare identifiers as related issues', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                `
- Issue: Fixes ENG-41
- Follow-up: ENG-42 (handled separately)

Additional work is tracked as ENG-42 and remains out of scope.
`,
                DEFAULT_SCAN_OPTIONS,
            ),
            [{ identifier: 'ENG-41' }],
        );
    });

    it('extracts an explicit Linear issue URL', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Related: https://linear.app/acme/issue/ENG-41/add-retry-policy.',
                DEFAULT_SCAN_OPTIONS,
            ),
            [
                {
                    identifier: 'ENG-41',
                    url: 'https://linear.app/acme/issue/ENG-41/add-retry-policy',
                    workspace: 'acme',
                },
            ],
        );
    });

    it('supports a URL without a title slug and excludes Markdown delimiters', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                '`https://linear.app/acme/issue/ENG-41` and https://linear.app/acme/issue/ENG-42',
                DEFAULT_SCAN_OPTIONS,
            ),
            [
                {
                    identifier: 'ENG-41',
                    url: 'https://linear.app/acme/issue/ENG-41',
                    workspace: 'acme',
                },
                {
                    identifier: 'ENG-42',
                    url: 'https://linear.app/acme/issue/ENG-42',
                    workspace: 'acme',
                },
            ],
        );
    });

    it('keeps identical issue identifiers separate across explicit workspaces', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'https://linear.app/acme/issue/ENG-41 https://linear.app/example/issue/ENG-41',
                DEFAULT_SCAN_OPTIONS,
            ),
            [
                {
                    identifier: 'ENG-41',
                    url: 'https://linear.app/acme/issue/ENG-41',
                    workspace: 'acme',
                },
                {
                    identifier: 'ENG-41',
                    url: 'https://linear.app/example/issue/ENG-41',
                    workspace: 'example',
                },
            ],
        );
    });

    it('deduplicates references while retaining the explicit URL', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Fixes ENG-41 ([issue](https://linear.app/acme/issue/ENG-41/fix-it))',
                DEFAULT_SCAN_OPTIONS,
            ),
            [
                {
                    identifier: 'ENG-41',
                    url: 'https://linear.app/acme/issue/ENG-41/fix-it',
                    workspace: 'acme',
                },
            ],
        );
    });

    it('supports closing keyword variants and normalizes identifiers', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Resolved **eng-12**\ncloses API2-7',
                DEFAULT_SCAN_OPTIONS,
            ),
            [{ identifier: 'ENG-12' }, { identifier: 'API2-7' }],
        );
    });

    it('ignores negated markers and stops at the end of a clause', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                "Don't fix ENG-11. This does not fully fix ENG-12 and won't resolve API2-7. Not related to ENG-14. Fixes ENG-13; follow-up ENG-15.",
                DEFAULT_SCAN_OPTIONS,
            ),
            [{ identifier: 'ENG-13' }],
        );
    });

    it('does not confuse the positive "not only" construction with negation', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Not only fixes ENG-16 but also documents the change.',
                DEFAULT_SCAN_OPTIONS,
            ),
            [{ identifier: 'ENG-16' }],
        );
    });

    it('does not treat a marker used in ordinary prose as an issue reference', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'This fix changes behavior tracked by ENG-41.',
                DEFAULT_SCAN_OPTIONS,
            ),
            [],
        );
    });

    it('stops a reference list when ordinary prose or a negation begins', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Fixes ENG-41, follow-up ENG-42. Fixes OPS-7 but not OPS-8.',
                DEFAULT_SCAN_OPTIONS,
            ),
            [{ identifier: 'ENG-41' }, { identifier: 'OPS-7' }],
        );
    });

    it('extracts multiple explicitly fixed issues from the same line', () => {
        deepStrictEqual(
            extractLinearIssueReferences('Issue: Fixes ENG-43, Fixes ENG-44', DEFAULT_SCAN_OPTIONS),
            [{ identifier: 'ENG-43' }, { identifier: 'ENG-44' }],
        );
    });

    it('extracts every issue from an explicit Related to line', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Related to ENG-20 (API), ENG-21 (client), OPS2-7 (deployment)',
                DEFAULT_SCAN_OPTIONS,
            ),
            [{ identifier: 'ENG-20' }, { identifier: 'ENG-21' }, { identifier: 'OPS2-7' }],
        );
    });

    it('allows punctuation inside reference annotations', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Related to ENG-20 (v2.0), ENG-21 (client).',
                DEFAULT_SCAN_OPTIONS,
            ),
            [{ identifier: 'ENG-20' }, { identifier: 'ENG-21' }],
        );
    });

    it('uses case-insensitive custom markers as literal phrases', () => {
        deepStrictEqual(
            extractLinearIssueReferences('TRACKS ENG-51. Fixes ENG-52', {
                markers: ['Tracks'],
                teamKeys: [],
            }),
            [{ identifier: 'ENG-51' }],
        );
        deepStrictEqual(
            extractLinearIssueReferences('Ticket(s): ENG-61', {
                markers: ['Ticket(s):'],
                teamKeys: [],
            }),
            [{ identifier: 'ENG-61' }],
        );
    });

    it('filters marker-based references through the configured team keys', () => {
        deepStrictEqual(
            extractLinearIssueReferences('Related to ENG-20, OPS2-7', {
                markers: ['Related to'],
                teamKeys: ['ops2'],
            }),
            [{ identifier: 'OPS2-7' }],
        );
    });

    it('always accepts explicit URLs when markers and team keys exclude the issue', () => {
        deepStrictEqual(
            extractLinearIssueReferences(
                'Fixes OPS2-7. https://linear.app/acme/issue/ENG-20/explicit-link',
                { markers: [], teamKeys: ['OPS2'] },
            ),
            [
                {
                    identifier: 'ENG-20',
                    url: 'https://linear.app/acme/issue/ENG-20/explicit-link',
                    workspace: 'acme',
                },
            ],
        );
    });
});

describe('#Linear settings', () => {
    it('contributes an independent disabled-by-default integration and generic scan settings', () => {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

        strictEqual(config.inspect<boolean>('linear.enabled')?.defaultValue, false);
        deepStrictEqual(config.inspect<string[]>('linear.referenceMarkers')?.defaultValue, [
            ...DEFAULT_LINEAR_REFERENCE_MARKERS,
        ]);
        deepStrictEqual(config.inspect<string[]>('linear.teamKeys')?.defaultValue, []);
        strictEqual(config.inspect<number>('refreshInterval')?.defaultValue, 30_000);
    });
});

describe('#ProjectStatusProvider integration gates', () => {
    it('shares PR discovery while gating GitHub and Linear consumers independently', async () => {
        const ghCalls: string[][] = [];
        let linearCalls = 0;
        const provider = new ProjectStatusProvider({
            fetchLinearIssues: async () => {
                linearCalls++;
                return [
                    {
                        identifier: 'ENG-41',
                        title: 'Add a retry policy',
                        url: 'https://linear.app/acme/issue/ENG-41/add-a-retry-policy',
                    },
                ];
            },
            runCli: async (_cmd, args) => {
                ghCalls.push(args);
                return githubProjectStatusResponse();
            },
        });
        const fetchGitHub = fetchGitHubForTest(provider);
        const ctx = TEST_REPO_CONTEXT;

        try {
            const githubState: Record<string, unknown> = { ctx };
            await fetchGitHub(ctx, githubState, {
                githubEnabled: true,
                ignoredChecks: [],
                linearEnabled: false,
                linearScan: DEFAULT_SCAN_OPTIONS,
            });

            strictEqual(graphqlVariable(ghCalls[0], 'includeGitHub'), 'true');
            strictEqual(graphqlVariable(ghCalls[0], 'includeLinear'), 'false');
            ok(githubState.pr);
            strictEqual(
                (githubState.visibleChecks as Array<{ name: string }> | undefined)?.[0]?.name,
                'Build',
            );
            strictEqual(githubState.linearIssues, undefined);
            strictEqual(linearCalls, 0);
            strictEqual(
                (githubState.unresolvedThreads as Array<{ url: string }> | undefined)?.length,
                1,
            );

            const linearState: Record<string, unknown> = { ctx };
            await fetchGitHub(ctx, linearState, {
                githubEnabled: false,
                ignoredChecks: [],
                linearEnabled: true,
                linearScan: DEFAULT_SCAN_OPTIONS,
            });

            strictEqual(graphqlVariable(ghCalls[1], 'includeGitHub'), 'false');
            strictEqual(graphqlVariable(ghCalls[1], 'includeLinear'), 'true');
            strictEqual(linearState.pr, undefined);
            strictEqual(linearState.ghChecked, undefined);
            strictEqual(linearState.unresolvedThreads, undefined);
            ok(linearState.linearIssues);
            strictEqual(linearCalls, 1);

            const combinedState: Record<string, unknown> = { ctx };
            await fetchGitHub(ctx, combinedState, {
                githubEnabled: true,
                ignoredChecks: [],
                linearEnabled: true,
                linearScan: DEFAULT_SCAN_OPTIONS,
            });

            strictEqual(graphqlVariable(ghCalls[2], 'includeGitHub'), 'true');
            strictEqual(graphqlVariable(ghCalls[2], 'includeLinear'), 'true');
            strictEqual(ghCalls.length, 3);
            strictEqual(linearCalls, 2);
            strictEqual(
                (combinedState.unresolvedThreads as Array<{ url: string }> | undefined)?.length,
                1,
            );
        } finally {
            provider.dispose();
        }
    });

    it('reports a missing gh dependency without attempting Linear resolution', async () => {
        let linearCalls = 0;
        const provider = new ProjectStatusProvider({
            fetchLinearIssues: async () => {
                linearCalls++;
                return [];
            },
            runCli: async () => {
                throw new CliError('NOT_FOUND', '', 'gh not installed');
            },
        });
        const fetchGitHub = fetchGitHubForTest(provider);
        const ctx = TEST_REPO_CONTEXT;
        const state: Record<string, unknown> = { ctx };

        try {
            await fetchGitHub(ctx, state, {
                githubEnabled: false,
                ignoredChecks: [],
                linearEnabled: true,
                linearScan: DEFAULT_SCAN_OPTIONS,
            });

            deepStrictEqual(state.ghError, { kind: 'NOT_FOUND' });
            strictEqual(state.linearError, undefined);
            strictEqual(linearCalls, 0);
        } finally {
            provider.dispose();
        }
    });

    it('backs off to the GraphQL reset and preserves the last successful PR state', async () => {
        const cliCalls: string[][] = [];
        let persistedResetAt: number | undefined;
        const provider = new ProjectStatusProvider({
            now: () => 1000,
            runCli: async (_cmd, args) => {
                cliCalls.push(args);
                if (args[1] === 'graphql') {
                    throw new CliError('RATE_LIMITED', 'GraphQL: API rate limit already exceeded');
                }
                return JSON.stringify({ remaining: 0, reset: 2 });
            },
            setGitHubRateLimitResetAt: (resetAt) => {
                persistedResetAt = resetAt;
            },
        });
        const fetchGitHub = fetchGitHubForTest(provider);
        const previous = {
            ci: 'success',
            ctx: TEST_REPO_CONTEXT,
            hasOpenPr: true,
            pr: {
                number: 7,
                statusCheckRollup: [],
                title: 'Improve retries',
                unresolvedThreads: [],
                url: 'https://github.com/acme/widgets/pull/7',
            },
        };
        const state: Record<string, unknown> = { ctx: TEST_REPO_CONTEXT };

        try {
            await fetchGitHub(
                TEST_REPO_CONTEXT,
                state,
                {
                    githubEnabled: true,
                    ignoredChecks: [],
                    linearEnabled: false,
                    linearScan: DEFAULT_SCAN_OPTIONS,
                },
                previous,
            );

            strictEqual(cliCalls.length, 2);
            strictEqual(cliCalls[1][1], 'rate_limit');
            strictEqual(persistedResetAt, 2000);
            deepStrictEqual(state.ghError, { kind: 'RATE_LIMITED', retryAt: 2000 });
            strictEqual(state.pr, previous.pr);

            const pausedState: Record<string, unknown> = { ctx: TEST_REPO_CONTEXT };
            await fetchGitHub(
                TEST_REPO_CONTEXT,
                pausedState,
                {
                    githubEnabled: true,
                    ignoredChecks: [],
                    linearEnabled: false,
                    linearScan: DEFAULT_SCAN_OPTIONS,
                },
                previous,
            );

            strictEqual(cliCalls.length, 2);
            deepStrictEqual(pausedState.ghError, {
                kind: 'RATE_LIMITED',
                retryAt: 2000,
            });
            strictEqual(pausedState.pr, previous.pr);
        } finally {
            provider.dispose();
        }
    });
});

describe('#linearIssueIcon', () => {
    it('renders In Progress as a static Linear-style progress wedge', () => {
        const svg = linearStatusIconSvg({
            name: 'In Progress',
            color: '#f2c94c',
            progress: 0.25,
            type: 'started',
        });
        ok(svg);
        match(svg, /A4 4 0 0 1 12 8Z/u);
        match(svg, /#f2c94c/u);
        strictEqual(svg.includes('animate'), false);
    });

    it('encodes normal status icons as a data SVG URI', () => {
        const icon = linearIssueIcon({
            identifier: 'ENG-44',
            state: {
                name: 'In Progress',
                color: '#f2c94c',
                progress: 0.25,
                type: 'started',
            },
        });
        ok('scheme' in icon);
        strictEqual(icon.scheme, 'data');
    });

    it('uses a neutral issue icon instead of repeating CLI warnings', () => {
        const icon = linearIssueIcon({ error: 'NOT_FOUND', identifier: 'ENG-44' });
        ok(icon instanceof vscode.ThemeIcon);
        strictEqual(icon.id, 'issues');
    });

    it('renders the remaining Linear workflow categories with their native geometry', () => {
        const backlog = linearStatusIconSvg({ name: 'Backlog', type: 'backlog' })!;
        match(backlog, /stroke-dasharray="1\.4 1\.742"/u);
        match(backlog, /stroke-dashoffset="0\.7"/u);
        strictEqual(backlog.includes('stroke-linecap="round"'), false);
        match(linearStatusIconSvg({ name: 'Todo', type: 'unstarted' })!, /<circle/u);
        match(linearStatusIconSvg({ name: 'Triage', type: 'triage' })!, /mask/u);
        match(linearStatusIconSvg({ name: 'Done', type: 'completed' })!, /4\.75 8/u);
        match(linearStatusIconSvg({ name: 'Canceled', type: 'canceled' })!, /m5 5 6 6/u);
    });
});

function graphqlVariable(args: string[], name: string): string | undefined {
    const prefix = `${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function githubProjectStatusResponse(): string {
    return JSON.stringify({
        data: {
            rateLimit: {
                cost: 1,
                remaining: 4000,
                resetAt: '2026-07-28T16:20:22Z',
            },
            search: {
                nodes: [
                    {
                        body: 'Tracks ENG-41',
                        commits: {
                            nodes: [
                                {
                                    commit: {
                                        statusCheckRollup: {
                                            contexts: {
                                                nodes: [
                                                    {
                                                        __typename: 'CheckRun',
                                                        conclusion: 'SUCCESS',
                                                        name: 'Build',
                                                        status: 'COMPLETED',
                                                    },
                                                ],
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                        number: 7,
                        reviewThreads: {
                            nodes: [
                                {
                                    comments: {
                                        nodes: [
                                            {
                                                author: { login: 'reviewer' },
                                                body: 'Please add a test.',
                                                url: 'https://github.com/acme/widgets/pull/7#discussion_r1',
                                            },
                                        ],
                                    },
                                    isOutdated: false,
                                    isResolved: false,
                                    path: 'src/index.ts',
                                },
                            ],
                        },
                        title: 'Improve retries',
                        url: 'https://github.com/acme/widgets/pull/7',
                    },
                ],
            },
        },
    });
}

function fetchGitHubForTest(provider: ProjectStatusProvider): FetchGitHubForTest {
    return (
        provider as unknown as {
            fetchGitHub: FetchGitHubForTest;
        }
    ).fetchGitHub.bind(provider);
}

describe('#ProjectStatusProvider Linear errors', () => {
    it('renders one repo-level error while preserving every unresolved issue row', async () => {
        const rootPath = '/repo';
        const provider = new ProjectStatusProvider();
        const internals = provider as unknown as {
            cache: Map<
                string,
                {
                    ctx: { isSubmodule: boolean; label: string; rootPath: string };
                    linearError: { kind: 'NOT_FOUND' };
                    linearIssues: Array<{
                        error: 'NOT_FOUND';
                        identifier: string;
                        url?: string;
                    }>;
                }
            >;
        };
        internals.cache.set(rootPath, {
            ctx: { isSubmodule: false, label: 'repo', rootPath },
            linearError: { kind: 'NOT_FOUND' },
            linearIssues: [
                { error: 'NOT_FOUND', identifier: 'ENG-1' },
                {
                    error: 'NOT_FOUND',
                    identifier: 'ENG-2',
                    url: 'https://linear.app/acme/issue/ENG-2',
                },
            ],
        });

        try {
            const children = await provider.getChildren({ kind: 'repo', rootPath });
            const issueNodes = children.filter((node) => node.kind === 'linearIssue');
            const errorNodes = children.filter(
                (node): node is Extract<SidebarNode, { kind: 'error' }> => node.kind === 'error',
            );

            strictEqual(issueNodes.length, 2);
            deepStrictEqual(errorNodes, [{ kind: 'error', rootPath, source: 'linear' }]);

            const firstIssue = provider.getTreeItem(issueNodes[0]);
            ok(firstIssue.iconPath instanceof vscode.ThemeIcon);
            strictEqual(firstIssue.iconPath.id, 'issues');
            strictEqual(firstIssue.description, undefined);

            const linkedIssue = provider.getTreeItem(issueNodes[1]);
            strictEqual(linkedIssue.command?.command, 'vscode.open');

            const errorItem = provider.getTreeItem(errorNodes[0]);
            strictEqual(errorItem.label, 'linear not installed');
            strictEqual(
                errorItem.description,
                'Install from https://github.com/schpet/linear-cli.',
            );
        } finally {
            provider.dispose();
        }
    });

    it('uses the workspace to keep identical issue identifiers unique', async () => {
        const rootPath = '/repo';
        const provider = new ProjectStatusProvider();
        const internals = provider as unknown as {
            cache: Map<
                string,
                {
                    ctx: { isSubmodule: boolean; label: string; rootPath: string };
                    linearIssues: Array<{
                        identifier: string;
                        url: string;
                        workspace: string;
                    }>;
                }
            >;
        };
        internals.cache.set(rootPath, {
            ctx: { isSubmodule: false, label: 'repo', rootPath },
            linearIssues: [
                {
                    identifier: 'ENG-41',
                    url: 'https://linear.app/acme/issue/ENG-41',
                    workspace: 'acme',
                },
                {
                    identifier: 'ENG-41',
                    url: 'https://linear.app/example/issue/ENG-41',
                    workspace: 'example',
                },
            ],
        });

        try {
            const children = await provider.getChildren({ kind: 'repo', rootPath });
            const issueNodes = children.filter((node) => node.kind === 'linearIssue');
            const ids = issueNodes.map((node) => provider.getTreeItem(node).id);

            deepStrictEqual(ids, [
                'linearIssue:/repo:acme:ENG-41',
                'linearIssue:/repo:example:ENG-41',
            ]);
        } finally {
            provider.dispose();
        }
    });
});

describe('#resolveLinearIssue', () => {
    it('queries linear-cli for workflow metadata and maps the response', async () => {
        const calls: unknown[][] = [];
        const issue = await resolveLinearIssue(
            { identifier: 'ENG-41', workspace: 'acme' },
            '/repo',
            async (...args) => {
                calls.push(args);
                return JSON.stringify({
                    data: {
                        issue: {
                            identifier: 'ENG-41',
                            title: 'Add a retry policy',
                            url: 'https://linear.app/acme/issue/ENG-41/add-a-retry-policy',
                            state: {
                                name: 'In Progress',
                                color: '#f2c94c',
                                type: 'started',
                                position: 2,
                            },
                            team: {
                                states: {
                                    nodes: [
                                        { name: 'In Progress', type: 'started', position: 2 },
                                        { name: 'In Review', type: 'started', position: 1002 },
                                        { name: 'Blocked', type: 'started', position: 2062 },
                                    ],
                                },
                            },
                        },
                    },
                });
            },
        );

        strictEqual(calls.length, 1);
        const [cmd, args, cwd] = calls[0] as ['linear', string[], string];
        strictEqual(cmd, 'linear');
        strictEqual(args[0], 'api');
        match(args[1], /state\{name color type position\}/u);
        deepStrictEqual(args.slice(2), ['--variable', 'id=ENG-41', '--workspace', 'acme']);
        strictEqual(cwd, '/repo');
        deepStrictEqual(issue, {
            identifier: 'ENG-41',
            title: 'Add a retry policy',
            url: 'https://linear.app/acme/issue/ENG-41/add-a-retry-policy',
            workspace: 'acme',
            state: {
                name: 'In Progress',
                color: '#f2c94c',
                progress: 0.25,
                type: 'started',
            },
        });
    });

    it('matches Linear progress steps for a two-state started workflow', async () => {
        const issue = await resolveLinearIssue({ identifier: 'ENG-41' }, '/repo', async () =>
            JSON.stringify({
                data: {
                    issue: {
                        identifier: 'ENG-41',
                        url: 'https://linear.app/acme/issue/ENG-41',
                        state: { name: 'In Progress', type: 'started', position: 2 },
                        team: {
                            states: {
                                nodes: [
                                    { name: 'In Progress', type: 'started', position: 2 },
                                    { name: 'In Review', type: 'started', position: 1002 },
                                ],
                            },
                        },
                    },
                },
            }),
        );

        strictEqual(issue.state?.progress, 0.5);
    });

    it('defaults an unresolved started-state position to a half-filled icon', async () => {
        const issue = await resolveLinearIssue({ identifier: 'ENG-41' }, '/repo', async () =>
            JSON.stringify({
                data: {
                    issue: {
                        identifier: 'ENG-41',
                        url: 'https://linear.app/acme/issue/ENG-41',
                        state: { name: 'In Progress', type: 'started' },
                    },
                },
            }),
        );

        strictEqual(issue.state?.progress, 0.5);
    });

    it('retains an explicit URL and exposes CLI failures', async () => {
        const issue = await resolveLinearIssue(
            {
                identifier: 'ENG-41',
                url: 'https://linear.app/acme/issue/ENG-41',
                workspace: 'acme',
            },
            '/repo',
            async () => {
                throw new CliError('NOT_LOGGED_IN', 'No API key configured');
            },
        );

        deepStrictEqual(issue, {
            error: 'NOT_LOGGED_IN',
            identifier: 'ENG-41',
            url: 'https://linear.app/acme/issue/ENG-41',
            workspace: 'acme',
        });
    });

    it('exposes an invalid JSON response as an error', async () => {
        const issue = await resolveLinearIssue(
            { identifier: 'ENG-41' },
            '/repo',
            async () => 'not json',
        );

        deepStrictEqual(issue, { error: 'OTHER', identifier: 'ENG-41' });
    });
});
