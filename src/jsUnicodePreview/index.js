// reference: https://github.com/kufii/vscode-js-unicode-preview/blob/master/src/extension.js

import { Range, Disposable, ThemeColor, window, workspace } from 'vscode';
import { getMatches, isUnicodePair, isUnicodeModifier, getSettings, curry } from './util';

let config;
const settingSection = 'vscode-fe-helper.js-unicode-preview';
const updateConfig = () => {
    config = getSettings(settingSection, ['languages', 'inline', 'hover']);
};

const setUnicodeDecorators = (editor, type) => {
    if (!editor || !config.languages.includes(editor.document.languageId)) return;

    const ifTrue = (bool, str) => (bool ? str : '');
    const escapeRegex = /(?<!\\)(?:(\\\\)*)/u.source;
    const octalRegex = (group) =>
        `\\\\(${ifTrue(!group, '?:')}[0-2][0-7]{0,2}|3[0-6][0-7]?|37[0-7]?|[4-7][0-7]?)`;
    const hexRegex = (group) => `\\\\x${ifTrue(group, '(')}[0-9A-Fa-f]{2}${ifTrue(group, ')')}`;
    const unicodeRegex = (group) => `\\\\u${ifTrue(group, '(')}[0-9A-Fa-f]{4}${ifTrue(group, ')')}`;
    const codePointRegex = (group) =>
        `\\\\u\\{${ifTrue(group, '(')}[0-9A-Fa-f]+${ifTrue(group, ')')}\\}`;

    const toDecorator = ({ text, startPos, endPos }) => ({
        range: new Range(editor.document.positionAt(startPos), editor.document.positionAt(endPos)),
        ...(config.hover && { hoverMessage: text }),
        ...(config.inline && {
            renderOptions: {
                after: {
                    contentText: text,
                    color: new ThemeColor('tab.activeForeground'),
                    opacity: '0.55',
                },
            },
        }),
    });

    const mergeModifiers = (decorators) => {
        let current;
        const merged = [];
        decorators.forEach((d) => {
            if (!current) current = d;
            else if (isUnicodeModifier(d.text)) {
                current.endPos = d.endPos;
                current.text += d.text;
            } else {
                merged.push(current);
                current = d;
            }
        });
        merged.push(current);
        return merged;
    };

    const matchToNum = curry((base, [_, group]) => parseInt(group, base));

    const processNoPairs = curry((base, match, index) => {
        const text = String.fromCodePoint(matchToNum(base, match));
        const startPos = index;
        const endPos = index + match[0].length;
        return { text, startPos, endPos };
    });
    const processHex = processNoPairs(16);
    const processOctal = processNoPairs(8);

    const processWithPairs = (str, index) => {
        const chars = getMatches(new RegExp(unicodeRegex(true), 'gu'), str).map(matchToNum(16));
        const decorators = [];

        for (let i = 0; i < chars.length; i++) {
            const firstPair = chars[i];
            const secondPair = i < chars.length - 1 && chars[i + 1];
            const startPos = index + i * 6;
            const endPos = startPos + 6;
            if (secondPair && isUnicodePair(firstPair, secondPair)) {
                decorators.push({
                    text: String.fromCharCode(firstPair, secondPair),
                    startPos,
                    endPos: endPos + 6,
                });
                i++;
            } else {
                decorators.push({ text: String.fromCodePoint(firstPair), startPos, endPos });
            }
        }

        return decorators;
    };

    const processSet = (match) => {
        const parts = match[0]
            .split(
                new RegExp(
                    `(${[octalRegex(), hexRegex(), codePointRegex()].join(
                        '|',
                    )}|(?:${unicodeRegex()})+)`,
                    'u',
                ),
            )
            .filter(Boolean);
        let index = match.index + match[1].length;
        const decorators = [];
        for (const part of parts) {
            let match = part.match(new RegExp(octalRegex(true), 'u'));
            if (match) decorators.push(processOctal(match, index));
            match = part.match(new RegExp(hexRegex(true), 'u'));
            if (match) decorators.push(processHex(match, index));
            match = part.match(new RegExp(unicodeRegex(), 'u'));
            if (match) decorators.push(...processWithPairs(part, index));
            match = part.match(new RegExp(codePointRegex(true), 'u'));
            if (match) decorators.push(processHex(match, index));
            index += part.length;
        }
        return mergeModifiers(decorators);
    };

    const decorators = getMatches(
        new RegExp(
            `(${escapeRegex})(?:${[octalRegex(), hexRegex(), unicodeRegex(), codePointRegex()].join(
                '|',
            )})+`,
            'gu',
        ),
        editor.document.getText(),
    )
        .map(processSet)
        .flat()
        .map(toDecorator);

    editor.setDecorations(type, decorators);
};

class DecoratorProvider extends Disposable {
    constructor() {
        super(() => this.dispose());
        this.disposables = [];
        this.timeout = null;
        this.activeEditor = window.activeTextEditor;
        this.decorationType = window.createTextEditorDecorationType({});
        setUnicodeDecorators(this.activeEditor, this.decorationType);

        window.onDidChangeActiveTextEditor(
            (editor) => {
                this.activeEditor = editor;
                editor && this.triggerUpdateDecorations();
            },
            this,
            this.disposables,
        );

        workspace.onDidChangeTextDocument(
            (event) =>
                this.activeEditor &&
                event.document === this.activeEditor.document &&
                this.triggerUpdateDecorations(),
            this,
            this.disposables,
        );
    }

    dispose() {
        let d;
        while ((d = this.disposables.pop())) d.dispose();
    }

    triggerUpdateDecorations() {
        if (this.timeout) return;
        this.timeout = setTimeout(() => {
            try {
                setUnicodeDecorators(this.activeEditor, this.decorationType);
            } catch (error) {
                console.error(error);
            } finally {
                this.timeout = null;
            }
        }, 300);
    }
}

export function jsUnicodePreview(context) {
    updateConfig();
    workspace.onDidChangeConfiguration(
        async (event) => {
            if (event.affectsConfiguration(settingSection)) {
                await updateConfig();
            }
        },
        null,
        context.subscriptions,
    );
    context.subscriptions.push(new DecoratorProvider());
}
