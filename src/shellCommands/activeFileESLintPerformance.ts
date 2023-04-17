import { runShellCommand } from './runShellCommand';

export async function activeFileESLintPerformance() {
    return runShellCommand('eslint', ['$file'], {
        env: {
            TIMING: '1',
        },
    });
}
