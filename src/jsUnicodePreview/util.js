import { workspace, window } from 'vscode';

const regexSurrogatePair = /([\uD800-\uDBFF])([\uDC00-\uDFFF])/;
const regexModifier = /\p{Modifier_Symbol}|\p{Mark}/iu;

export const isUnicodePair = (hex1, hex2) =>
    regexSurrogatePair.test(String.fromCharCode(hex1, hex2));

export const isUnicodeModifier = (char) => regexModifier.test(char);

export const getMatches = (regex, str) => {
    const matches = [];
    let match;
    while ((match = regex.exec(str))) {
        matches.push(match);
    }
    return matches;
};

export const getSettings = (group, keys) => {
    const settings = workspace.getConfiguration(group, null);
    const editor = window.activeTextEditor;
    const language = editor && editor.document && editor.document.languageId;
    const languageSettings =
        language && workspace.getConfiguration(null, null).get(`[${language}]`);
    return keys.reduce((acc, k) => {
        acc[k] = languageSettings && languageSettings[`${group}.${k}`];
        if (acc[k] == null) acc[k] = settings.get(k);
        return acc;
    }, {});
};

export const curry =
    (fn) =>
    (...args) =>
        args.length < fn.length ? curry(fn.bind(null, ...args)) : fn(...args);
