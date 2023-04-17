import { runShellCommand } from './runShellCommand';

export async function forceStylelint() {
    return runShellCommand('stylelint', ['--ignore-path', '$emptyIgnoreFile', '$file']);
}
