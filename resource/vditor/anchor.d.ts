// Types for anchor.js, so the unit tests can import the webview module

export interface CommentAnchor {
    exact: string;
    prefix: string;
    suffix: string;
}

export function normalize(text: string): { text: string; map: number[] };
export function createAnchor(text: string, start: number, end: number, maxLength?: number): CommentAnchor | null;
export function findAnchor(text: string, anchor: Partial<CommentAnchor> | null | undefined): { start: number; end: number } | null;
