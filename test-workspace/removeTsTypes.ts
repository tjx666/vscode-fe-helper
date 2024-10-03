class C<T> extends Array<T> implements I {
    //     ^^^              ^^^^^^^^^^^^^^^^
    private field!: string;
    //  ^^^^^^^      ^^^^^^^^^

    method<T>(this: T, a?: string): void {
        //        ^^^ ^^^^^^^^  ^^^^^^^^^ ^^^^^^
    }
}
