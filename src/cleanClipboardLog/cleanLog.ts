import { logger } from '../utils/log';

export interface CleanRule {
    pattern: string;
    flags?: string;
    action: 'removeLine' | 'replace';
    replacement?: string;
}

export interface CleanResult {
    output: string;
    inputLines: number;
    outputLines: number;
    skippedRules: number;
}

function countLines(text: string): number {
    if (text.length === 0) return 0;
    return text.split('\n').length;
}

export function cleanLog(raw: string, rules: CleanRule[]): CleanResult {
    const inputLines = countLines(raw);
    let output = raw;
    let skippedRules = 0;

    for (const [index, rule] of rules.entries()) {
        let regex: RegExp;
        try {
            regex = new RegExp(rule.pattern, rule.flags ?? 'g');
        } catch (error) {
            skippedRules += 1;
            logger.log(
                `[cleanClipboardLog] skipped rule #${index} (invalid regex /${rule.pattern}/${rule.flags ?? ''}): ${String(error)}`,
            );
            continue;
        }

        if (rule.action === 'removeLine') {
            // strip the `g` flag — regex.test() with `g` is stateful and skips alternating lines
            const lineRegex = regex.global
                ? new RegExp(regex.source, regex.flags.replace('g', ''))
                : regex;
            output = output
                .split('\n')
                .filter((line) => !lineRegex.test(line))
                .join('\n');
        } else {
            output = output.replace(regex, rule.replacement ?? '');
        }
    }

    return {
        output,
        inputLines,
        outputLines: countLines(output),
        skippedRules,
    };
}
