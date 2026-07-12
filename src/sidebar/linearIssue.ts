import { logEvent, logTiming } from '../utils/log';
import type { CliErrorKind } from './cli';
import { CliError, runCli } from './cli';
import { safeJsonParse } from './common';

export interface LinearIssueReference {
    identifier: string;
    url?: string;
    workspace?: string;
}

export interface LinearReferenceScanOptions {
    markers: readonly string[];
    teamKeys: readonly string[];
}

export type LinearIssueStateType =
    | 'backlog'
    | 'canceled'
    | 'completed'
    | 'duplicate'
    | 'started'
    | 'triage'
    | 'unstarted';

export interface LinearIssueEntry extends LinearIssueReference {
    error?: CliErrorKind;
    title?: string;
    state?: {
        name: string;
        color?: string;
        progress?: number;
        type?: LinearIssueStateType;
    };
}

interface RawLinearWorkflowState {
    name?: string;
    color?: string;
    type?: string;
    position?: number;
}

interface RawLinearIssue {
    identifier?: string;
    title?: string;
    url?: string;
    state?: RawLinearWorkflowState | null;
    team?: {
        states?: { nodes?: RawLinearWorkflowState[] };
    } | null;
}

interface RawLinearApiResponse {
    data?: { issue?: RawLinearIssue | null };
}

interface ReferenceCandidate extends LinearIssueReference {
    index: number;
}

interface CachedIssue {
    expiresAt: number;
    promise: Promise<LinearIssueEntry>;
}

type LinearCliRunner = (cmd: 'linear', args: string[], cwd: string) => Promise<string>;

const CACHE_TTL_MS = 60_000;
const issueCache = new Map<string, CachedIssue>();
const LINEAR_ISSUE_QUERY = `query IssueStatus($id:String!){
  issue(id:$id){
    identifier
    title
    url
    state{name color type position}
    team{states(first:50){nodes{name color type position}}}
  }
}`;
export const DEFAULT_LINEAR_REFERENCE_MARKERS = [
    'Fix',
    'Fixes',
    'Fixed',
    'Close',
    'Closes',
    'Closed',
    'Resolve',
    'Resolves',
    'Resolved',
    'Related to',
] as const;
const LINEAR_ISSUE_URL =
    /https?:\/\/linear\.app\/([a-z0-9][a-z0-9-]*)\/issue\/([a-z][a-z0-9]*-[1-9]\d*)(?:\/[^\s<>()[\]'"`]*)?/giu;
const LINEAR_ISSUE_IDENTIFIER = /\b([a-z][a-z0-9]*-[1-9]\d*)\b/giu;
const NEGATED_REFERENCE_MARKER =
    /\b(?!not[ \t]+only\b)(?:do(?:es)? not|did not|will not|would not|could not|should not|cannot|can't|won't|don't|doesn't|didn't|couldn't|wouldn't|shouldn't|never|not)\b[^.;:!?\r\n]{0,24}$/iu;
const MAX_CONFIGURED_MARKERS = 32;
const MAX_MARKER_LENGTH = 64;
const MAX_CONFIGURED_TEAM_KEYS = 32;
const MAX_REFERENCE_PREFIX_LENGTH = 24;

/**
 * Find Linear issues deliberately associated with a PR.
 *
 * Bare issue identifiers are ignored because PR descriptions often mention follow-up or out-of-
 * scope work. We only accept identifiers introduced by a configured marker or an explicit Linear
 * issue URL.
 */
export function extractLinearIssueReferences(
    body: string,
    options: LinearReferenceScanOptions,
): LinearIssueReference[] {
    const candidates: ReferenceCandidate[] = [];

    for (const match of body.matchAll(LINEAR_ISSUE_URL)) {
        const rawUrl = match[0];
        const workspace = match[1];
        const identifier = match[2];
        if (match.index === undefined || !workspace || !identifier) continue;
        candidates.push({
            index: match.index,
            identifier: identifier.toUpperCase(),
            url: trimTrailingPunctuation(rawUrl),
            workspace: workspace.toLowerCase(),
        });
    }

    const teamKeys = normalizeTeamKeys(options.teamKeys);
    const markers = findReferenceMarkers(body, options.markers);
    for (const [index, marker] of markers.entries()) {
        const lineStart = body.lastIndexOf('\n', marker.index - 1) + 1;
        const prefix = body.slice(Math.max(lineStart, marker.index - 32), marker.index);
        if (NEGATED_REFERENCE_MARKER.test(prefix)) continue;

        const nextLineBreak = body.indexOf('\n', marker.end);
        const lineEnd = nextLineBreak < 0 ? body.length : nextLineBreak;
        const nextMarker = markers[index + 1];
        const clauseEnd = findClauseEnd(body, marker.end, lineEnd);
        const referenceEnd = Math.min(
            lineEnd,
            clauseEnd,
            nextMarker && nextMarker.index < lineEnd ? nextMarker.index : lineEnd,
        );
        const referenceText = body.slice(marker.end, referenceEnd);
        const identifierMatches = [...referenceText.matchAll(LINEAR_ISSUE_IDENTIFIER)];
        const firstIdentifier = identifierMatches[0];
        if (
            firstIdentifier?.index === undefined ||
            !isReferencePrefix(referenceText.slice(0, firstIdentifier.index))
        ) {
            continue;
        }

        for (const [matchIndex, identifierMatch] of identifierMatches.entries()) {
            const identifier = identifierMatch[1];
            if (identifierMatch.index === undefined || !identifier) continue;
            if (matchIndex > 0) {
                const previousMatch = identifierMatches[matchIndex - 1];
                const previousEnd = previousMatch.index! + previousMatch[0].length;
                const separator = referenceText.slice(previousEnd, identifierMatch.index);
                if (!isReferenceListSeparator(separator)) break;
            }
            const normalizedIdentifier = identifier.toUpperCase();
            if (!teamKeyAllowed(normalizedIdentifier, teamKeys)) continue;
            candidates.push({
                index: marker.end + identifierMatch.index,
                identifier: normalizedIdentifier,
            });
        }
    }

    candidates.sort((a, b) => a.index - b.index);
    const references: ReferenceCandidate[] = [];
    for (const candidate of candidates) {
        const existing = references.find(
            (reference) =>
                reference.identifier === candidate.identifier &&
                (reference.workspace === candidate.workspace ||
                    !reference.workspace ||
                    !candidate.workspace),
        );
        if (!existing) {
            references.push({ ...candidate });
        } else if (!existing.url && candidate.url) {
            existing.url = candidate.url;
            existing.workspace = candidate.workspace;
        }
    }
    return references.map(({ identifier, url, workspace }) => ({
        identifier,
        ...(url ? { url } : {}),
        ...(workspace ? { workspace } : {}),
    }));
}

/**
 * Resolve issue titles, states, and canonical URLs through schpet/linear-cli. Individual lookup
 * failures are isolated so Linear can never hide the rest of a repository's GitHub status.
 */
export async function fetchLinearIssues(
    body: string,
    cwd: string,
    options: LinearReferenceScanOptions,
): Promise<LinearIssueEntry[]> {
    const references = extractLinearIssueReferences(body, options);
    if (references.length === 0) return [];

    const start = Date.now();
    const issues = await Promise.all(
        references.map((reference) => fetchLinearIssue(reference, cwd)),
    );
    logTiming('sidebar.linear.issues', start, `refs=${references.length}`);
    return issues;
}

async function fetchLinearIssue(
    reference: LinearIssueReference,
    cwd: string,
): Promise<LinearIssueEntry> {
    const cacheKey = `${cwd}\0${reference.workspace ?? ''}\0${reference.identifier}\0${reference.url ?? ''}`;
    const cached = issueCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = resolveLinearIssue(reference, cwd);
    issueCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
    return promise;
}

export async function resolveLinearIssue(
    reference: LinearIssueReference,
    cwd: string,
    runner: LinearCliRunner = runCli,
): Promise<LinearIssueEntry> {
    try {
        const args = ['api', LINEAR_ISSUE_QUERY, '--variable', `id=${reference.identifier}`];
        if (reference.workspace) args.push('--workspace', reference.workspace);
        const stdout = await runner('linear', args, cwd);
        const raw = safeJsonParse<RawLinearApiResponse | null>(stdout, null)?.data?.issue;
        if (!raw?.url) {
            logEvent('sidebar.linear.issue', `${reference.identifier} fail=INVALID_RESPONSE`);
            return fallbackEntry(reference, 'OTHER');
        }
        return {
            identifier: (raw.identifier ?? reference.identifier).toUpperCase(),
            title: raw.title,
            url: raw.url,
            ...(reference.workspace ? { workspace: reference.workspace } : {}),
            state: normalizeLinearIssueState(raw.state, raw.team?.states?.nodes),
        };
    } catch (error) {
        const kind = error instanceof CliError ? error.kind : 'OTHER';
        logEvent('sidebar.linear.issue', `${reference.identifier} fail=${kind}`);
        return fallbackEntry(reference, kind);
    }
}

function normalizeLinearIssueState(
    state: RawLinearWorkflowState | null | undefined,
    teamStates: RawLinearWorkflowState[] | undefined,
): LinearIssueEntry['state'] {
    if (!state?.name) return undefined;
    const type = normalizeStateType(state.type);
    return {
        name: state.name,
        color: state.color,
        type,
        progress: type === 'started' ? startedStateProgress(state, teamStates) : undefined,
    };
}

function normalizeStateType(type: string | undefined): LinearIssueStateType | undefined {
    switch (type) {
        case 'backlog':
        case 'canceled':
        case 'completed':
        case 'duplicate':
        case 'started':
        case 'triage':
        case 'unstarted':
            return type;
        default:
            return undefined;
    }
}

function startedStateProgress(
    current: RawLinearWorkflowState,
    teamStates: RawLinearWorkflowState[] | undefined,
): number {
    const started = (teamStates ?? [])
        .filter((state) => state.type === 'started')
        .sort((a, b) => (a.position ?? Number.MAX_VALUE) - (b.position ?? Number.MAX_VALUE));
    const index = started.findIndex((state) => state.name === current.name);
    if (index >= 0) {
        if (started.length === 1) return 0.5;
        if (started.length === 2) return index === 0 ? 0.5 : 0.75;
        return (index + 1) / (started.length + 1);
    }

    return 0.5;
}

function fallbackEntry(reference: LinearIssueReference, error: CliErrorKind): LinearIssueEntry {
    return { ...reference, error };
}

function trimTrailingPunctuation(url: string): string {
    return url.replaceAll(/[.,;:!?]+$/gu, '');
}

function findReferenceMarkers(
    body: string,
    configuredMarkers: readonly string[],
): Array<{ end: number; index: number }> {
    const markers = new Map<string, string>();
    for (const configuredMarker of configuredMarkers.slice(0, MAX_CONFIGURED_MARKERS)) {
        if (typeof configuredMarker !== 'string') continue;
        const marker = configuredMarker.trim().replaceAll(/\s+/gu, ' ').slice(0, MAX_MARKER_LENGTH);
        if (!marker) continue;
        const key = marker.toLowerCase();
        if (!markers.has(key)) markers.set(key, marker);
    }
    if (markers.size === 0) return [];

    const alternatives = [...markers.values()]
        .sort((a, b) => b.length - a.length)
        .map((marker) => {
            const parts = marker.split(' ').map((part) => escapeRegExp(part));
            const phrase = parts.join(String.raw`[\t ]+`);
            const prefix = /^\w/iu.test(marker) ? String.raw`(?<!\w)` : '';
            const suffix = /\w$/iu.test(marker) ? String.raw`(?!\w)` : '';
            return `${prefix}${phrase}${suffix}`;
        });
    const markerPattern = new RegExp(alternatives.join('|'), 'giu');

    const matches: Array<{ end: number; index: number }> = [];
    for (const match of body.matchAll(markerPattern)) {
        if (match.index === undefined) continue;
        matches.push({ end: match.index + match[0].length, index: match.index });
    }
    return matches;
}

function normalizeTeamKeys(configuredTeamKeys: readonly string[]): Set<string> {
    const keys = new Set<string>();
    for (const configuredTeamKey of configuredTeamKeys.slice(0, MAX_CONFIGURED_TEAM_KEYS)) {
        if (typeof configuredTeamKey !== 'string') continue;
        const key = configuredTeamKey.trim().toUpperCase();
        if (/^[A-Z][A-Z0-9]*$/u.test(key)) keys.add(key);
    }
    return keys;
}

function teamKeyAllowed(identifier: string, teamKeys: ReadonlySet<string>): boolean {
    if (teamKeys.size === 0) return true;
    const separator = identifier.lastIndexOf('-');
    return separator > 0 && teamKeys.has(identifier.slice(0, separator));
}

function findClauseEnd(body: string, start: number, lineEnd: number): number {
    let parenthesisDepth = 0;
    for (let index = start; index < lineEnd; index++) {
        const character = body[index];
        if (character === '(') {
            parenthesisDepth++;
            continue;
        }
        if (character === ')' && parenthesisDepth > 0) {
            parenthesisDepth--;
            continue;
        }
        if (parenthesisDepth > 0) continue;
        if (character === '.' || character === ';' || character === '!' || character === '?') {
            return index;
        }
        if (
            character === '—' &&
            /[ \t]/u.test(body[index - 1] ?? '') &&
            /[ \t]/u.test(body[index + 1] ?? '')
        ) {
            return index;
        }
    }
    return lineEnd;
}

function isReferencePrefix(value: string): boolean {
    return value.length <= MAX_REFERENCE_PREFIX_LENGTH && !/[\p{L}\p{N}]/u.test(value);
}

function isReferenceListSeparator(value: string): boolean {
    const withoutAnnotations = value.replaceAll(/\([^()]*\)/gu, '');
    const normalized = withoutAnnotations.replaceAll(/[\s*_`()[\]]/gu, '').toLowerCase();
    return (
        normalized === ',' ||
        normalized === ',and' ||
        normalized === 'and' ||
        normalized === '&' ||
        normalized === '/'
    );
}

function escapeRegExp(value: string): string {
    return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
