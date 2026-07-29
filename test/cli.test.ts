import { strictEqual } from 'node:assert';

import { classifyCliError } from '../src/sidebar/cli';

describe('#classifyCliError', () => {
    it('recognizes primary and secondary API rate limits', () => {
        strictEqual(
            classifyCliError({}, 'GraphQL: API rate limit already exceeded for user ID 1.'),
            'RATE_LIMITED',
        );
        strictEqual(
            classifyCliError({}, 'You have exceeded a secondary rate limit.'),
            'RATE_LIMITED',
        );
    });

    it('keeps unrelated GitHub failures generic', () => {
        strictEqual(classifyCliError({}, 'GraphQL: Something went wrong.'), 'OTHER');
    });
});
