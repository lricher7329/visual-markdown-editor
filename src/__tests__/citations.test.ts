import { describe, it, expect, vi } from 'vitest';

// bibTexService pulls in the Zotero service, which imports the VS Code API
vi.mock('vscode', () => ({}));

import { escapeBibtex, extractCitations } from '../service/zotero/bibTexService';

describe('extractCitations', () => {
    it('should find bracketed, bare and author-suppressed citations', () => {
        const markdown = 'As shown by @smith2020, see [@doe2019; @roe2018, p. 4] and [-@lee2021].';
        expect(extractCitations(markdown)).toEqual(['smith2020', 'doe2019', 'roe2018', 'lee2021']);
    });

    it('should ignore email addresses and URLs', () => {
        const markdown = 'Contact jane@example.com or see https://medium.com/@author for @real2020.';
        expect(extractCitations(markdown)).toEqual(['real2020']);
    });

    it('should ignore code blocks and inline code', () => {
        const markdown = [
            'Cite @kept2020.',
            '',
            '```python',
            '@decorator',
            'def f(): pass',
            '```',
            '',
            'CSS uses `@media` queries.',
        ].join('\n');
        expect(extractCitations(markdown)).toEqual(['kept2020']);
    });
});

describe('escapeBibtex', () => {
    it('should escape special characters', () => {
        expect(escapeBibtex('R&D 50% $5 #1 a_b')).toBe('R\\&D 50\\% \\$5 \\#1 a\\_b');
    });

    it('should not re-escape the braces it inserts for backslashes', () => {
        expect(escapeBibtex('a\\b')).toBe('a\\textbackslash{}b');
        expect(escapeBibtex('{x}~^')).toBe('\\{x\\}\\textasciitilde{}\\textasciicircum{}');
    });
});
