import vscode from 'vscode';

/**
 * Coordinates badge refreshes. Fires onTick listeners on a fixed interval, but
 * suspends while the VS Code window is unfocused and re-fires immediately on
 * focus regained or branch change. Per-badge backoff (e.g. terminal-state)
 * is the badge's own responsibility — the scheduler stays dumb.
 */
export class Scheduler implements vscode.Disposable {
    private timer: NodeJS.Timeout | undefined;
    private listeners: Array<() => void | Promise<void>> = [];
    private disposables: vscode.Disposable[] = [];
    private focused = vscode.window.state.focused;
    private intervalMs = 30_000;

    constructor() {
        this.disposables.push(
            vscode.window.onDidChangeWindowState((s) => {
                const wasFocused = this.focused;
                this.focused = s.focused;
                if (!wasFocused && s.focused) this.fire();
            }),
        );
    }

    setInterval(ms: number): void {
        this.intervalMs = Math.max(5000, ms);
        this.restart();
    }

    onTick(fn: () => void | Promise<void>): void {
        this.listeners.push(fn);
    }

    start(): void {
        this.restart();
        this.fire();
    }

    triggerNow(): void {
        this.fire();
    }

    private restart(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (this.focused) this.fire();
        }, this.intervalMs);
    }

    private fire(): void {
        for (const fn of this.listeners) {
            Promise.resolve(fn()).catch(() => {
                // Listeners are responsible for their own error handling.
            });
        }
    }

    dispose(): void {
        if (this.timer) clearInterval(this.timer);
        this.disposables.forEach((d) => d.dispose());
    }
}
