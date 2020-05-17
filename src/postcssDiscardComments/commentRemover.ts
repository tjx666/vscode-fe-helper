class CommentRemover {
    private _hasFirst = false;

    constructor(private options: Record<string, any>) {}

    canRemove(comment: string): boolean {
        const { remove } = this.options;

        if (remove) {
            return remove(comment);
        }

        const isImportant = comment.indexOf('!') === 0;

        if (!isImportant) {
            return true;
        }

        if (this.options.removeAll || this._hasFirst) {
            return true;
        }

        if (this.options.removeAllButFirst && !this._hasFirst) {
            this._hasFirst = true;
            return false;
        }

        return false;
    }
}

export default CommentRemover;
