import { Buffer } from 'node:buffer';

import vscode from 'vscode';

import type { LinearIssueEntry, LinearIssueStateType } from './linearIssue';

const FALLBACK_COLORS: Record<LinearIssueStateType, string> = {
    backlog: '#bec2c8',
    canceled: '#95a2b3',
    completed: '#5e6ad2',
    duplicate: '#95a2b3',
    started: '#f2c94c',
    triage: '#FC7840',
    unstarted: '#e2e2e2',
};

export function linearIssueIcon(issue: LinearIssueEntry): vscode.ThemeIcon | vscode.Uri {
    const svg = linearStatusIconSvg(issue.state);
    if (!svg) return new vscode.ThemeIcon('issues');
    const encoded = Buffer.from(svg).toString('base64');
    return vscode.Uri.parse(`data:image/svg+xml;base64,${encoded}`);
}

/** Render a small, static Linear-style workflow glyph using the status's configured color. */
export function linearStatusIconSvg(state: LinearIssueEntry['state']): string | undefined {
    const type = state?.type;
    if (!type) return undefined;
    const color = validColor(state?.color) ?? FALLBACK_COLORS[type];

    switch (type) {
        case 'triage':
            return maskedCircle(
                color,
                '<path d="M4.5 8h2.75M4.5 8l1.25-1.25M4.5 8l1.25 1.25M11.5 8H8.75M11.5 8l-1.25-1.25M11.5 8l-1.25 1.25"/>',
            );
        case 'backlog':
            return wrapSvg(
                `<circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="1.4 1.742" stroke-dashoffset="0.7"/>`,
            );
        case 'unstarted':
            return wrapSvg(circleOutline(color));
        case 'started': {
            const rawProgress = state?.progress;
            const progress =
                typeof rawProgress === 'number' && Number.isFinite(rawProgress)
                    ? Math.min(0.95, Math.max(0.05, rawProgress))
                    : 0.5;
            return wrapSvg(`${progressWedge(color, progress)}${circleOutline(color)}`);
        }
        case 'completed':
            return maskedCircle(color, '<path d="m4.75 8 2.1 2.1 4.4-4.7"/>');
        case 'canceled':
        case 'duplicate':
            return maskedCircle(color, '<path d="m5 5 6 6M11 5l-6 6"/>');
    }

    return undefined;
}

function validColor(color: string | undefined): string | undefined {
    return color && /^#[\da-f]{3}(?:[\da-f]{3})?$/iu.test(color) ? color : undefined;
}

function circleOutline(color: string): string {
    return `<circle cx="8" cy="8" r="5.75" fill="none" stroke="${color}" stroke-width="1.5"/>`;
}

function progressWedge(color: string, progress: number): string {
    const angle = -Math.PI / 2 + progress * Math.PI * 2;
    const x = formatCoordinate(8 + Math.cos(angle) * 4);
    const y = formatCoordinate(8 + Math.sin(angle) * 4);
    const largeArc = progress > 0.5 ? 1 : 0;
    return `<path d="M8 8V4A4 4 0 ${largeArc} 1 ${x} ${y}Z" fill="${color}"/>`;
}

function formatCoordinate(value: number): string {
    return Number(value.toFixed(3)).toString();
}

function maskedCircle(color: string, cutout: string): string {
    return wrapSvg(
        `<defs><mask id="cutout"><rect width="16" height="16" fill="white"/><g fill="none" stroke="black" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${cutout}</g></mask></defs><circle cx="8" cy="8" r="6" fill="${color}" mask="url(#cutout)"/>`,
    );
}

function wrapSvg(content: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">${content}</svg>`;
}
