import os from 'node:os';

import type vscode from 'vscode';

import { logEvent, logTiming } from '../utils/log';
import { CliError, runCli } from './cli';
import { parseVcList, safeJsonParse, vcLsArgs } from './common';

interface Team {
    slug: string;
}

export interface VercelLink {
    team: string;
    project: string;
}

const STATE_KEY_PREFIX = 'vscode-fe-helper.projectStatus.vercelLink:';
const LEGACY_TEAM_KEY_PREFIX = 'vscode-fe-helper.projectStatus.vercelTeam:';

const memCache = new Map<string, VercelLink | null>();
const inFlight = new Map<string, Promise<VercelLink | null>>();
let stateRef: vscode.Memento | undefined;

export function initVercelLink(state: vscode.Memento): void {
    stateRef = state;
}

/**
 * Resolve the Vercel team + project that owns the given GitHub repo, by scanning the user's
 * accessible teams sequentially. Result is cached in-process forever (within the session) and
 * persisted in globalState only on success — this lets a not-yet-deployed repo pick up its link
 * after the first deployment lands without needing a manual cache reset.
 */
export async function findVercelLink(owner: string, repo: string): Promise<VercelLink | null> {
    const key = `${owner}/${repo}`;
    if (memCache.has(key)) {
        const link = memCache.get(key) ?? null;
        logEvent(
            'vercelLink',
            `mem hit ${key} -> ${link ? `${link.team}/${link.project}` : 'null'}`,
        );
        return link;
    }

    const persisted = stateRef?.get<VercelLink>(STATE_KEY_PREFIX + key);
    if (persisted?.team && persisted?.project) {
        memCache.set(key, persisted);
        logEvent('vercelLink', `persisted hit ${key} -> ${persisted.team}/${persisted.project}`);
        return persisted;
    }

    let pending = inFlight.get(key);
    if (!pending) {
        const start = Date.now();
        pending = scanTeams(owner, repo).finally(() => {
            inFlight.delete(key);
            logTiming('vercelLink.scan', start, key);
        });
        inFlight.set(key, pending);
    } else {
        logEvent('vercelLink', `awaiting in-flight scan ${key}`);
    }
    const link = await pending;

    if (link) {
        memCache.set(key, link);
        if (stateRef) await stateRef.update(STATE_KEY_PREFIX + key, link);
    }
    // Don't memoize null: a transient CLI failure shouldn't permanently mask a
    // real link until the user manually resets the cache.
    return link;
}

export async function resetVercelLinkCache(): Promise<void> {
    memCache.clear();
    if (!stateRef) return;
    for (const key of stateRef.keys()) {
        if (key.startsWith(STATE_KEY_PREFIX) || key.startsWith(LEGACY_TEAM_KEY_PREFIX)) {
            // eslint-disable-next-line no-await-in-loop, unicorn/no-useless-undefined
            await stateRef.update(key, undefined);
        }
    }
}

async function scanTeams(owner: string, repo: string): Promise<VercelLink | null> {
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

    // Probe teams in parallel. Each probe resolves to a link on hit, null on
    // clean no-match, and rethrows CliError so the caller surfaces the failure
    // (otherwise an auth/network error would look identical to "no team owns
    // this repo" and silently disable the Vercel section).
    const probes = teams.map(async (team) => {
        try {
            const stdout = await runCli(
                'vc',
                vcLsArgs(team.slug, { meta: { githubOrg: owner, githubRepo: repo } }),
                cwd,
            );
            const list = parseVcList<{ name?: string }>(stdout);
            const project = list[0]?.name;
            return project ? { team: team.slug, project } : null;
        } catch (error) {
            if (error instanceof CliError) throw error;
            return null;
        }
    });

    const results = await Promise.all(probes);
    return results.find((r): r is VercelLink => r !== null) ?? null;
}
