import { plugin, list } from 'postcss';

import CommentRemover from './commentRemover';
import commentParser from './commentParser';

const { space } = list;

// copy from https://github.com/ben-eb/postcss-discard-comments/tree/master/src
export default plugin('postcss-discard-comments', (opts: Record<string, any> = {}) => {
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

        // eslint-disable-next-line unicorn/no-reduce
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

    return (css) => {
        css.walk((node: any) => {
            if (node.type === 'comment' && remover.canRemove(node.text)) {
                node.remove();

                return;
            }

            if (node.raws.between) {
                node.raws.between = replaceComments(node.raws.between);
            }

            if (node.type === 'decl') {
                if (node.raws.value && node.raws.value.raw) {
                    if (node.raws.value.value === node.value) {
                        node.value = replaceComments(node.raws.value.raw);
                    } else {
                        node.value = replaceComments(node.value);
                    }

                    node.raws.value = null;
                }

                if (node.raws.important) {
                    node.raws.important = replaceComments(node.raws.important);

                    const b = matchesComments(node.raws.important);

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

                    if (commentsReplaced.length === 0) {
                        node.raws.afterName = `${commentsReplaced} `;
                    } else {
                        node.raws.afterName = ` ${commentsReplaced} `;
                    }
                }

                if (node.raws.params && node.raws.params.raw) {
                    node.raws.params.raw = replaceComments(node.raws.params.raw);
                }
            }
        });
    };
});
