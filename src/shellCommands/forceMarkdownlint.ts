import { runShellCommand } from './runShellCommand';

export async function forceMarkdownlint() {
    return runShellCommand('markdownlint', ['--ignore-path', '$emptyIgnoreFile', '$file']);
}
