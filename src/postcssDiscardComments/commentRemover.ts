class CommentRemover {
    private _hasFirst = false;
    constructor(private options: any) {}

    canRemove(comment: string) {
        const remove = this.options.remove;

        if (remove) {
            return remove(comment);
        } else {
            const isImportant = comment.indexOf('!') === 0;

            if (!isImportant) {
                return true;
            }

            if (this.options.removeAll || this._hasFirst) {
                return true;
            } else if (this.options.removeAllButFirst && !this._hasFirst) {
                this._hasFirst = true;
                return false;
            }
        }
    }
}

export default CommentRemover;