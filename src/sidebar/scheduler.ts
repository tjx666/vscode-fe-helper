import vscode from 'vscode';

export type RefreshReason = 'branch' | 'config' | 'focus' | 'interval' | 'manual' | 'startup';

type TickListener = (reason: RefreshReason) => number | void | Promise<number | void>;

export const PENDING_REFRESH_INTERVAL_MS = 20_000;
export const ACTIVE_REFRESH_INTERVAL_MS = 60_000;
export const IDLE_REFRESH_INTERVAL_MS = 120_000;

export interface AdaptiveRefreshOptions {
    fallbackMs: number;
    githubPausedUntil?: number;
    hasActive: boolean;
    hasNonGitHubPolling: boolean;
    hasPending: boolean;
    now?: number;
}

/**
 * Pending work stays responsive, while terminal and empty states back off. If GitHub is the only
 * enabled integration, a known rate-limit reset becomes the next wake-up instead of another poll.
 */
export function adaptiveRefreshInterval(options: AdaptiveRefreshOptions): number {
    const now = options.now ?? Date.now();
    if (
        !options.hasNonGitHubPolling &&
        options.githubPausedUntil &&
        options.githubPausedUntil > now
    ) {
        return options.githubPausedUntil - now;
    }
    if (options.hasPending) return Math.min(options.fallbackMs, PENDING_REFRESH_INTERVAL_MS);
    if (options.hasActive) return Math.max(options.fallbackMs, ACTIVE_REFRESH_INTERVAL_MS);
    return Math.max(options.fallbackMs, IDLE_REFRESH_INTERVAL_MS);
}

/**
 * Runs one refresh at a time and schedules the next tick from the listener's recommended delay.
 * Interval ticks are dropped while busy; user, focus, config, and branch events collapse into one
 * trailing refresh.
 */
export class Scheduler implements vscode.Disposable {
    private timer: NodeJS.Timeout | undefined;
    private listeners: TickListener[] = [];
    private disposables: vscode.Disposable[] = [];
    private focused = vscode.window.state.focused;
    private readonly fallbackMs: number;
    private running: Promise<void> | undefined;
    private pendingReason: RefreshReason | undefined;
    private disposed = false;

    constructor(intervalMs: number) {
        this.fallbackMs = Math.max(5000, intervalMs);
        this.disposables.push(
            vscode.window.onDidChangeWindowState((state) => {
                const wasFocused = this.focused;
                this.focused = state.focused;
                if (!state.focused) this.clearTimer();
                else if (!wasFocused) this.triggerNow('focus');
            }),
        );
    }

    onTick(fn: TickListener): void {
        this.listeners.push(fn);
    }

    start(reason: Extract<RefreshReason, 'config' | 'startup'> = 'startup'): void {
        this.triggerNow(reason);
    }

    triggerNow(reason: Exclude<RefreshReason, 'interval' | 'startup'>): Promise<void>;
    triggerNow(reason: RefreshReason): Promise<void>;
    triggerNow(reason: RefreshReason): Promise<void> {
        if (this.disposed) return Promise.resolve();
        if (!this.focused && reason !== 'manual') {
            this.pendingReason = reason;
            return Promise.resolve();
        }
        this.clearTimer();
        if (this.running) {
            if (reason !== 'interval') this.pendingReason = reason;
            return this.running;
        }

        this.pendingReason = undefined;
        const running = this.run(reason);
        this.running = running;
        return running;
    }

    private async run(reason: RefreshReason): Promise<void> {
        let nextDelay: number | undefined;
        try {
            const recommendations = await Promise.all(
                this.listeners.map((listener) => Promise.resolve(listener(reason))),
            );
            for (const recommendation of recommendations) {
                if (
                    typeof recommendation === 'number' &&
                    Number.isFinite(recommendation) &&
                    recommendation > 0
                ) {
                    nextDelay =
                        nextDelay === undefined
                            ? recommendation
                            : Math.min(nextDelay, recommendation);
                }
            }
        } catch {
            // Listeners own their diagnostics; the scheduler must remain alive after a failed tick.
        } finally {
            this.running = undefined;
            if (this.disposed) return;

            const pendingReason = this.pendingReason;
            this.pendingReason = undefined;
            if (pendingReason && this.focused) {
                this.triggerNow(pendingReason);
                return;
            }
            this.schedule(nextDelay ?? this.fallbackMs);
        }
    }

    private schedule(delayMs: number): void {
        this.clearTimer();
        if (!this.focused || this.disposed) return;
        /**
         * A small positive jitter prevents several focused VS Code extension hosts from polling the
         * same GitHub account in lockstep.
         */
        const jitterRange = Math.min(5000, Math.floor(delayMs * 0.1));
        const delayWithJitter = delayMs + Math.floor(Math.random() * (jitterRange + 1));
        this.timer = setTimeout(() => {
            this.triggerNow('interval');
        }, delayWithJitter);
    }

    private clearTimer(): void {
        if (!this.timer) return;
        clearTimeout(this.timer);
        this.timer = undefined;
    }

    dispose(): void {
        this.disposed = true;
        this.clearTimer();
        this.disposables.forEach((disposable) => disposable.dispose());
    }
}
