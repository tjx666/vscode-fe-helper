import type { Plugin, PluginCreator, Root } from 'postcss';
import { list } from 'postcss';

import commentParser from './commentParser';
import CommentRemover from './commentRemover';

const { space } = list;

/**
 * Copied from
 * https://github.com/cssnano/cssnano/blob/master/packages/postcss-discard-comments/src/index.js
 */
const discardCommentsPlugin: PluginCreator<Record<string, any>> = (opts = {}): Plugin => {
    const remover = new CommentRemover(opts);
    const matcherCache: Record<string, any> = {};
    const replacerCache: Record<string, any> = {};

    function matchesComments(source: string) {
        if (matcherCache[source]) {
            return matcherCache[source];
        }

        const result = commentParser(source).filter(([type]) => type);

        matcherCache[source] = result;

        return result;
    }

    function replaceComments(source: string, separator = ' ') {
        const key = `${source}@|@${separator}`;

        if (replacerCache[key]) {
            return replacerCache[key];
        }

        const parsed = commentParser(source).reduce((value, [type, start, end]) => {
            const contents = source.slice(start, end);

            if (!type) {
                return value + contents;
            }

            if (remover.canRemove(contents)) {
                return value + separator;
            }

            return `${value}/*${contents}*/`;
        }, '');

        const result = space(parsed).join(' ');

        replacerCache[key] = result;

        return result;
    }

    return {
        postcssPlugin: 'postcss-discard-comments',
        Root: (root: Root): any => {
            root.walk((node: any) => {
                if (node.type === 'comment' && remover.canRemove(node.text)) {
                    node.remove();

                    return;
                }

                if (node.raws.between) {
                    node.raws.between = replaceComments(node.raws.between);
                }

                if (node.type === 'decl') {
                    if (node.raws.value && node.raws.value.raw) {
                        node.value =
                            node.raws.value.value === node.value
                                ? replaceComments(node.raws.value.raw)
                                : replaceComments(node.value);

                        node.raws.value = null;
                    }

                    if (node.raws.important) {
                        node.raws.important = replaceComments(node.raws.important);

                        const b = matchesComments(node.raws.important);

                        // eslint-disable-next-line unicorn/explicit-length-check
                        node.raws.important = b.length !== 0 ? node.raws.important : '!important';
                    }

                    return;
                }

                if (node.type === 'rule' && node.raws.selector && node.raws.selector.raw) {
                    node.raws.selector.raw = replaceComments(node.raws.selector.raw, '');

                    return;
                }

                if (node.type === 'atrule') {
                    if (node.raws.afterName) {
                        const commentsReplaced = replaceComments(node.raws.afterName);

                        node.raws.afterName =
                            commentsReplaced.length === 0
                                ? `${commentsReplaced} `
                                : ` ${commentsReplaced} `;
                    }

                    if (node.raws.params && node.raws.params.raw) {
                        node.raws.params.raw = replaceComments(node.raws.params.raw);
                    }
                }
            });
        },
    };
};

discardCommentsPlugin.postcss = true;
export default discardCommentsPlugin;
