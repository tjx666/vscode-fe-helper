import os from 'node:os';

import type vscode from 'vscode';

import { CliError, runCli } from './cli';
import { parseVcList, safeJsonParse } from './common';

interface Team {
    slug: string;
}

const STATE_KEY_PREFIX = 'vscode-fe-helper.projectStatus.vercelTeam:';

const memCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
let stateRef: vscode.Memento | undefined;

export function initVercelLink(state: vscode.Memento): void {
    stateRef = state;
}

/**
 * Resolve the Vercel team slug that owns the given GitHub repo, by scanning the user's accessible
 * teams sequentially. Result is cached in-process forever (within the session) and persisted in
 * globalState only on success — this lets a not-yet-deployed repo pick up its team after the first
 * deployment lands without needing a manual cache reset.
 */
export async function findVercelTeam(owner: string, repo: string): Promise<string | null> {
    const key = `${owner}/${repo}`;
    if (memCache.has(key)) return memCache.get(key) ?? null;

    const persisted = stateRef?.get<string>(STATE_KEY_PREFIX + key);
    if (persisted) {
        memCache.set(key, persisted);
        return persisted;
    }

    let pending = inFlight.get(key);
    if (!pending) {
        pending = scanTeams(owner, repo).finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
    }
    const team = await pending;

    if (team) {
        memCache.set(key, team);
        if (stateRef) await stateRef.update(STATE_KEY_PREFIX + key, team);
    }
    // Don't memoize null: a transient CLI failure shouldn't permanently mask a
    // real link until the user manually resets the cache.
    return team;
}

export async function resetVercelLinkCache(): Promise<void> {
    memCache.clear();
    if (!stateRef) return;
    for (const key of stateRef.keys()) {
        if (key.startsWith(STATE_KEY_PREFIX)) {
            // eslint-disable-next-line no-await-in-loop, unicorn/no-useless-undefined
            await stateRef.update(key, undefined);
        }
    }
}

async function scanTeams(owner: string, repo: string): Promise<string | null> {
    const cwd = os.homedir();

    let teamsJson: string;
    try {
        teamsJson = await runCli('vc', ['teams', 'ls', '--format', 'json'], cwd);
    } catch (error) {
        // If we can't even list teams, propagate the error context. The
        // sidebar surfaces it under the repo's Vercel section.
        if (error instanceof CliError) throw error;
        throw new CliError('OTHER', String(error), 'Failed to list Vercel teams');
    }

    const parsed = safeJsonParse<{ teams?: Team[] } | Team[]>(teamsJson, []);
    const teams = (Array.isArray(parsed) ? parsed : (parsed.teams ?? [])).filter((t) => t.slug);
    if (teams.length === 0) return null;

    // Probe teams in parallel. Each probe resolves to a slug on hit, null on
    // clean no-match, and rethrows CliError so the caller surfaces the failure
    // (otherwise an auth/network error would look identical to "no team owns
    // this repo" and silently disable the Vercel section).
    const probes = teams.map(async (team) => {
        try {
            const stdout = await runCli(
                'vc',
                [
                    'ls',
                    '--format',
                    'json',
                    '--scope',
                    team.slug,
                    '--meta',
                    `githubOrg=${owner}`,
                    '--meta',
                    `githubRepo=${repo}`,
                    '--yes',
                ],
                cwd,
            );
            const list = parseVcList<unknown>(stdout);
            return list.length > 0 ? team.slug : null;
        } catch (error) {
            if (error instanceof CliError) throw error;
            return null;
        }
    });

    const results = await Promise.all(probes);
    return results.find((slug): slug is string => slug !== null) ?? null;
}
