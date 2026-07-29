import type { RunCli } from './cli';
import { runCli } from './cli';
import { safeJsonParse } from './common';
import type { RepoContext } from './gitContext';

export interface GitHubCheckEntry {
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

export interface ReviewThreadEntry {
    path?: string;
    line?: number | null;
    body: string;
    url: string;
    author?: string;
    createdAt?: string;
}

export interface GitHubPullRequest {
    number: number;
    url: string;
    title: string;
    body?: string;
    statusCheckRollup: GitHubCheckEntry[];
    unresolvedThreads: ReviewThreadEntry[];
}

export interface GitHubRateLimit {
    cost: number;
    remaining: number;
    resetAt: string;
}

export interface GitHubProjectStatus {
    pr?: GitHubPullRequest;
    rateLimit?: GitHubRateLimit;
}

interface RawAuthor {
    login?: string;
}

interface RawComment {
    body?: string;
    url?: string;
    createdAt?: string;
    author?: RawAuthor | null;
}

interface RawReviewThread {
    isResolved?: boolean;
    isOutdated?: boolean;
    path?: string;
    line?: number | null;
    comments?: { nodes?: RawComment[] };
}

interface RawCheckRun {
    __typename: 'CheckRun';
    name?: string;
    conclusion?: string | null;
    status?: string | null;
    detailsUrl?: string;
    startedAt?: string | null;
    completedAt?: string | null;
    checkSuite?: {
        workflowRun?: {
            workflow?: { name?: string } | null;
        } | null;
    } | null;
}

interface RawStatusContext {
    __typename: 'StatusContext';
    context?: string;
    state?: string | null;
    targetUrl?: string;
}

type RawCheck = RawCheckRun | RawStatusContext;

interface RawPullRequest {
    number?: number;
    url?: string;
    title?: string;
    body?: string;
    commits?: {
        nodes?: Array<{
            commit?: {
                statusCheckRollup?: {
                    contexts?: { nodes?: RawCheck[] };
                } | null;
            };
        }>;
    };
    reviewThreads?: { nodes?: RawReviewThread[] };
}

interface RawProjectStatusResponse {
    data?: {
        search?: { nodes?: RawPullRequest[] };
        rateLimit?: GitHubRateLimit;
    };
}

interface RawRateLimitResponse {
    remaining?: number;
    reset?: number;
}

/**
 * One query replaces `gh pr list` plus the follow-up review-thread request. Keeping the search at
 * `first: 1` keeps the nested checks and review-thread connections at the minimum observed cost; a
 * larger outer connection multiplies both.
 */
export const PROJECT_STATUS_QUERY = `query SidebarProjectStatus(
  $queryString: String!
  $includeGitHub: Boolean!
  $includeLinear: Boolean!
) {
  search(query: $queryString, type: ISSUE, first: 1) {
    nodes {
      ... on PullRequest {
        number
        url
        title
        body @include(if: $includeLinear)
        commits(last: 1) @include(if: $includeGitHub) {
          nodes {
            commit {
              statusCheckRollup {
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      conclusion
                      status
                      detailsUrl
                      startedAt
                      completedAt
                      checkSuite {
                        workflowRun {
                          workflow {
                            name
                          }
                        }
                      }
                    }
                    ... on StatusContext {
                      context
                      state
                      targetUrl
                    }
                  }
                }
              }
            }
          }
        }
        reviewThreads(first: 50) @include(if: $includeGitHub) {
          nodes {
            isResolved
            isOutdated
            path
            line
            comments(first: 1) {
              nodes {
                body
                url
                createdAt
                author {
                  login
                }
              }
            }
          }
        }
      }
    }
  }
  rateLimit {
    cost
    remaining
    resetAt
  }
}`;

export function projectStatusQueryArgs(
    ctx: Pick<RepoContext, 'branch' | 'owner' | 'repo'>,
    options: { githubEnabled: boolean; linearEnabled: boolean },
): string[] {
    const queryString = [
        `repo:${ctx.owner}/${ctx.repo}`,
        'is:pr',
        'is:open',
        'author:@me',
        `head:${JSON.stringify(ctx.branch)}`,
    ].join(' ');

    return [
        'api',
        'graphql',
        '--cache',
        '15s',
        '-F',
        `queryString=${queryString}`,
        '-F',
        `includeGitHub=${options.githubEnabled}`,
        '-F',
        `includeLinear=${options.linearEnabled}`,
        '-f',
        `query=${PROJECT_STATUS_QUERY}`,
    ];
}

export async function fetchGitHubProjectStatus(
    ctx: RepoContext,
    options: { githubEnabled: boolean; linearEnabled: boolean },
    runner: RunCli = runCli,
): Promise<GitHubProjectStatus> {
    if (!ctx.owner || !ctx.repo || !ctx.branch) return {};
    const stdout = await runner(
        'gh',
        projectStatusQueryArgs(ctx, options),
        ctx.rootPath,
        `repo=${ctx.owner}/${ctx.repo} branch=${ctx.branch}`,
    );
    return parseProjectStatusResponse(stdout);
}

export function parseProjectStatusResponse(stdout: string): GitHubProjectStatus {
    const raw = safeJsonParse<RawProjectStatusResponse>(stdout, {});
    const rawPr = raw.data?.search?.nodes?.[0];
    const rateLimit = parseRateLimit(raw.data?.rateLimit);
    if (rawPr?.number === undefined || rawPr.url === undefined || rawPr.title === undefined) {
        return { rateLimit };
    }

    const rawChecks =
        rawPr.commits?.nodes?.at(-1)?.commit?.statusCheckRollup?.contexts?.nodes ?? [];
    const statusCheckRollup = rawChecks.map(mapCheck);
    const unresolvedThreads = parseReviewThreads(rawPr.reviewThreads?.nodes ?? []);

    return {
        pr: {
            body: rawPr.body,
            number: rawPr.number,
            statusCheckRollup,
            title: rawPr.title,
            unresolvedThreads,
            url: rawPr.url,
        },
        rateLimit,
    };
}

/**
 * The REST rate-limit endpoint does not consume the primary REST quota. It gives us the GraphQL
 * reset time even after GraphQL itself has stopped accepting queries.
 */
export async function fetchGraphqlRateLimit(
    cwd: string,
    runner: RunCli = runCli,
): Promise<{ remaining: number; resetAt: number } | undefined> {
    const stdout = await runner(
        'gh',
        ['api', 'rate_limit', '--jq', '.resources.graphql | {remaining, reset}'],
        cwd,
        'resource=graphql-rate-limit',
    );
    const raw = safeJsonParse<RawRateLimitResponse>(stdout, {});
    if (raw.remaining === undefined || raw.reset === undefined) return undefined;
    return { remaining: raw.remaining, resetAt: raw.reset * 1000 };
}

function parseRateLimit(raw: GitHubRateLimit | undefined): GitHubRateLimit | undefined {
    if (raw?.cost === undefined || raw.remaining === undefined || typeof raw.resetAt !== 'string') {
        return undefined;
    }
    return raw;
}

function mapCheck(raw: RawCheck): GitHubCheckEntry {
    if (raw.__typename === 'StatusContext') {
        return {
            context: raw.context,
            state: raw.state,
            targetUrl: raw.targetUrl,
        };
    }
    return {
        completedAt: raw.completedAt,
        conclusion: raw.conclusion,
        detailsUrl: raw.detailsUrl,
        name: raw.name,
        startedAt: raw.startedAt,
        status: raw.status,
        workflowName: raw.checkSuite?.workflowRun?.workflow?.name,
    };
}

function parseReviewThreads(rawThreads: RawReviewThread[]): ReviewThreadEntry[] {
    const result: ReviewThreadEntry[] = [];
    for (const thread of rawThreads) {
        if (thread.isResolved || thread.isOutdated) continue;
        const comment = thread.comments?.nodes?.[0];
        if (!comment?.url) continue;
        result.push({
            author: comment.author?.login,
            body: comment.body ?? '',
            createdAt: comment.createdAt,
            line: thread.line ?? null,
            path: thread.path,
            url: comment.url,
        });
    }
    return result;
}
