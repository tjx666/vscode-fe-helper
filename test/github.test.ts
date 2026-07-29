import { deepStrictEqual, match, strictEqual } from 'node:assert';

import {
    fetchGraphqlRateLimit,
    parseProjectStatusResponse,
    projectStatusQueryArgs,
} from '../src/sidebar/github';

describe('#GitHub project status query', () => {
    it('builds one cached, author-scoped GraphQL request for a repository branch', () => {
        const args = projectStatusQueryArgs(
            {
                branch: 'fix/reasoning-signature-scope',
                owner: 'lobehub',
                repo: 'lobe-chat',
            },
            { githubEnabled: true, linearEnabled: false },
        );

        deepStrictEqual(args.slice(0, 4), ['api', 'graphql', '--cache', '15s']);
        strictEqual(
            fieldValue(args, 'queryString'),
            'repo:lobehub/lobe-chat is:pr is:open author:@me head:"fix/reasoning-signature-scope"',
        );
        strictEqual(fieldValue(args, 'includeGitHub'), 'true');
        strictEqual(fieldValue(args, 'includeLinear'), 'false');
        match(rawFieldValue(args, 'query') ?? '', /reviewThreads\(first: 50\)/u);
        match(rawFieldValue(args, 'query') ?? '', /statusCheckRollup/u);
        match(rawFieldValue(args, 'query') ?? '', /rateLimit/u);
    });

    it('maps checks and keeps only current unresolved review threads', () => {
        const result = parseProjectStatusResponse(
            JSON.stringify({
                data: {
                    rateLimit: {
                        cost: 1,
                        remaining: 3210,
                        resetAt: '2026-07-28T16:20:22Z',
                    },
                    search: {
                        nodes: [
                            {
                                commits: {
                                    nodes: [
                                        {
                                            commit: {
                                                statusCheckRollup: {
                                                    contexts: {
                                                        nodes: [
                                                            {
                                                                __typename: 'CheckRun',
                                                                checkSuite: {
                                                                    workflowRun: {
                                                                        workflow: { name: 'Test' },
                                                                    },
                                                                },
                                                                conclusion: null,
                                                                detailsUrl:
                                                                    'https://github.com/acme/widgets/actions/runs/1',
                                                                name: 'Unit tests',
                                                                status: 'IN_PROGRESS',
                                                            },
                                                            {
                                                                __typename: 'StatusContext',
                                                                context: 'Vercel',
                                                                state: 'SUCCESS',
                                                                targetUrl:
                                                                    'https://vercel.com/acme/widgets/1',
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
                                        reviewThread({
                                            body: 'Please add a test.',
                                            url: 'https://github.com/acme/widgets/pull/7#discussion_r1',
                                        }),
                                        reviewThread({
                                            isResolved: true,
                                            url: 'https://github.com/acme/widgets/pull/7#discussion_r2',
                                        }),
                                        reviewThread({
                                            isOutdated: true,
                                            url: 'https://github.com/acme/widgets/pull/7#discussion_r3',
                                        }),
                                    ],
                                },
                                title: 'Improve retries',
                                url: 'https://github.com/acme/widgets/pull/7',
                            },
                        ],
                    },
                },
            }),
        );

        deepStrictEqual(result.rateLimit, {
            cost: 1,
            remaining: 3210,
            resetAt: '2026-07-28T16:20:22Z',
        });
        deepStrictEqual(result.pr?.statusCheckRollup, [
            {
                completedAt: undefined,
                conclusion: null,
                detailsUrl: 'https://github.com/acme/widgets/actions/runs/1',
                name: 'Unit tests',
                startedAt: undefined,
                status: 'IN_PROGRESS',
                workflowName: 'Test',
            },
            {
                context: 'Vercel',
                state: 'SUCCESS',
                targetUrl: 'https://vercel.com/acme/widgets/1',
            },
        ]);
        deepStrictEqual(result.pr?.unresolvedThreads, [
            {
                author: 'reviewer',
                body: 'Please add a test.',
                createdAt: undefined,
                line: 12,
                path: 'src/index.ts',
                url: 'https://github.com/acme/widgets/pull/7#discussion_r1',
            },
        ]);
    });

    it('reads the GraphQL reset from the REST rate-limit endpoint', async () => {
        const calls: string[][] = [];
        const result = await fetchGraphqlRateLimit('/repo', async (_cmd, args) => {
            calls.push(args);
            return JSON.stringify({ remaining: 0, reset: 1785255612 });
        });

        deepStrictEqual(calls, [
            ['api', 'rate_limit', '--jq', '.resources.graphql | {remaining, reset}'],
        ]);
        deepStrictEqual(result, { remaining: 0, resetAt: 1785255612000 });
    });
});

function fieldValue(args: string[], name: string): string | undefined {
    return argumentValue(args, '-F', name);
}

function rawFieldValue(args: string[], name: string): string | undefined {
    return argumentValue(args, '-f', name);
}

function argumentValue(args: string[], flag: '-F' | '-f', name: string): string | undefined {
    const prefix = `${name}=`;
    for (let index = 0; index < args.length - 1; index++) {
        if (args[index] === flag && args[index + 1].startsWith(prefix)) {
            return args[index + 1].slice(prefix.length);
        }
    }
    return undefined;
}

function reviewThread(options: {
    body?: string;
    isOutdated?: boolean;
    isResolved?: boolean;
    url: string;
}) {
    return {
        comments: {
            nodes: [
                {
                    author: { login: 'reviewer' },
                    body: options.body,
                    url: options.url,
                },
            ],
        },
        isOutdated: options.isOutdated ?? false,
        isResolved: options.isResolved ?? false,
        line: 12,
        path: 'src/index.ts',
    };
}
