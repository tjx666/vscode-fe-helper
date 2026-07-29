import { strictEqual } from 'node:assert';

import {
    ACTIVE_REFRESH_INTERVAL_MS,
    adaptiveRefreshInterval,
    IDLE_REFRESH_INTERVAL_MS,
    PENDING_REFRESH_INTERVAL_MS,
} from '../src/sidebar/scheduler';

describe('#adaptiveRefreshInterval', () => {
    const fallbackMs = 30_000;

    it('polls pending work every 20 seconds', () => {
        strictEqual(
            adaptiveRefreshInterval({
                fallbackMs,
                hasActive: true,
                hasNonGitHubPolling: false,
                hasPending: true,
            }),
            PENDING_REFRESH_INTERVAL_MS,
        );
    });

    it('backs completed work off to 60 seconds', () => {
        strictEqual(
            adaptiveRefreshInterval({
                fallbackMs,
                hasActive: true,
                hasNonGitHubPolling: false,
                hasPending: false,
            }),
            ACTIVE_REFRESH_INTERVAL_MS,
        );
    });

    it('backs an empty branch off to 120 seconds', () => {
        strictEqual(
            adaptiveRefreshInterval({
                fallbackMs,
                hasActive: false,
                hasNonGitHubPolling: false,
                hasPending: false,
            }),
            IDLE_REFRESH_INTERVAL_MS,
        );
    });

    it('waits for the GitHub reset when no other integration needs polling', () => {
        strictEqual(
            adaptiveRefreshInterval({
                fallbackMs,
                githubPausedUntil: 250_000,
                hasActive: true,
                hasNonGitHubPolling: false,
                hasPending: true,
                now: 100_000,
            }),
            150_000,
        );
    });

    it('continues adaptive polling for Vercel while GitHub is paused', () => {
        strictEqual(
            adaptiveRefreshInterval({
                fallbackMs,
                githubPausedUntil: 250_000,
                hasActive: true,
                hasNonGitHubPolling: true,
                hasPending: true,
                now: 100_000,
            }),
            PENDING_REFRESH_INTERVAL_MS,
        );
    });
});
