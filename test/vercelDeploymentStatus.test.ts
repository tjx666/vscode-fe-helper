import { strictEqual } from 'node:assert';

import { statusOf } from '../src/sidebar/tree';

describe('#statusOf', () => {
    it('does not treat skipped Vercel deployments as failed', () => {
        strictEqual(
            statusOf({
                url: 'lobehub-cloud-next-bwif0-lobehub-pro.vercel.app',
                readyState: 'CANCELED',
                state: 'CANCELED',
            }),
            'canceled',
        );
    });

    it('still treats errored Vercel deployments as failed', () => {
        strictEqual(
            statusOf({
                url: 'lobehub-cloud-next-bad-lobehub-pro.vercel.app',
                readyState: 'ERROR',
                state: 'ERROR',
            }),
            'failed',
        );
    });
});
