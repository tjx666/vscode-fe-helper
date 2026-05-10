import { logEvent, logTiming } from '../utils/log';
import { CliError, runCli } from './cli';
import { safeJsonParse } from './common';
import type { RepoContext } from './gitContext';

export interface ReviewThreadEntry {
    path?: string;
    line?: number | null;
    body: string;
    url: string;
    author?: string;
    createdAt?: string;
}

interface RawComment {
    body?: string;
    url?: string;
    createdAt?: string;
    author?: { login?: string } | null;
}

interface RawThread {
    isResolved?: boolean;
    isOutdated?: boolean;
    path?: string;
    line?: number | null;
    comments?: { nodes?: RawComment[] };
}

interface RawResponse {
    data?: {
        repository?: {
            pullRequest?: {
                reviewThreads?: { nodes?: RawThread[] };
            };
        };
    };
}

const QUERY = `query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$number){
      reviewThreads(first:50){
        nodes{
          isResolved
          isOutdated
          path
          line
          comments(first:1){
            nodes{ body url createdAt author{ login } }
          }
        }
      }
    }
  }
}`;

/**
 * Failures are swallowed: a graphql hiccup shouldn't blank out the rest of the PR node. Caller
 * relies on this never throwing.
 */
export async function fetchUnresolvedThreads(
    ctx: RepoContext,
    prNumber: number,
): Promise<ReviewThreadEntry[]> {
    const { owner, repo, rootPath } = ctx;
    if (!owner || !repo) return [];
    const start = Date.now();
    try {
        const stdout = await runCli(
            'gh',
            [
                'api',
                'graphql',
                '-F',
                `owner=${owner}`,
                '-F',
                `repo=${repo}`,
                '-F',
                `number=${prNumber}`,
                '-f',
                `query=${QUERY}`,
            ],
            rootPath,
        );
        const parsed = safeJsonParse<RawResponse>(stdout, {});
        const nodes = parsed.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
        const result: ReviewThreadEntry[] = [];
        for (const t of nodes) {
            if (t.isResolved || t.isOutdated) continue;
            const c = t.comments?.nodes?.[0];
            if (!c?.url) continue;
            result.push({
                path: t.path,
                line: t.line ?? null,
                body: c.body ?? '',
                url: c.url,
                author: c.author?.login,
                createdAt: c.createdAt,
            });
        }
        logTiming(
            'sidebar.gh.reviewThreads',
            start,
            `${owner}/${repo}#${prNumber} -> ${result.length}`,
        );
        return result;
    } catch (error) {
        const kind = error instanceof CliError ? error.kind : 'OTHER';
        logEvent('sidebar.gh.reviewThreads', `${owner}/${repo}#${prNumber} fail=${kind}`);
        return [];
    }
}
