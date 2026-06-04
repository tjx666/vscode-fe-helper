import { strictEqual } from 'node:assert';

import { vercelInspectorUrl } from '../src/sidebar/common';

describe('#vercelInspectorUrl', () => {
    it('derives the inspector URL from a canonical deployment host', () => {
        strictEqual(
            vercelInspectorUrl(
                'yutengjings-projects',
                'sweet',
                'sweet-87c565vql-yutengjings-projects.vercel.app',
            ),
            'https://vercel.com/yutengjings-projects/sweet/87c565vql',
        );
    });

    it('tolerates a protocol-prefixed host', () => {
        strictEqual(
            vercelInspectorUrl(
                'yutengjings-projects',
                'sweet',
                'https://sweet-87c565vql-yutengjings-projects.vercel.app',
            ),
            'https://vercel.com/yutengjings-projects/sweet/87c565vql',
        );
    });

    it('handles hyphenated project and team slugs', () => {
        strictEqual(
            vercelInspectorUrl(
                'lobe-hub-landing',
                'my-app',
                'my-app-abc123-lobe-hub-landing.vercel.app',
            ),
            'https://vercel.com/lobe-hub-landing/my-app/abc123',
        );
    });

    it('returns undefined for a non-standard host (e.g. custom alias)', () => {
        strictEqual(vercelInspectorUrl('team', 'project', 'custom-domain.example.com'), undefined);
    });

    it('returns undefined when the host has no deploy hash', () => {
        strictEqual(vercelInspectorUrl('team', 'project', 'project-team.vercel.app'), undefined);
    });
});
