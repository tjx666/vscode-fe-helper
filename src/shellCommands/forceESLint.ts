import { runShellCommand } from './runShellCommand';

export async function forceESLint() {
    return runShellCommand('eslint', ['--no-ignore', '$file']);
}
