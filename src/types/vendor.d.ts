declare module '*/markdown/markdown-pdf' {
    export function convertMd(options: { markdownFilePath: string; config: Record<string, unknown> }): Promise<void>;
}

declare module 'sql.js' {
    export interface QueryExecResult {
        columns: string[];
        values: (string | number | Uint8Array | null)[][];
    }

    export interface Database {
        exec(sql: string): QueryExecResult[];
        close(): void;
    }

    export interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
    }

    export interface InitSqlJsOptions {
        locateFile?: (file: string) => string;
    }

    export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>;
}
