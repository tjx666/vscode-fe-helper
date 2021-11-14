declare module 'postcss-scss';
declare module 'postcss-less';

declare module 'lebab' {
    interface IProblem {
        type: string;
        msg: string;
        line: number;
    }

    interface IResult {
        code: string;
        warnings: IProblem[];
    }

    function transform(source: string, transforms: string[]): IResult;

    export { transform };
    export type { IResult, IProblem };
}
