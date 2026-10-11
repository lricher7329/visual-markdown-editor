import { describe, it, expect } from 'vitest';
import { normalize, createAnchor, findAnchor } from '../../resource/vditor/anchor.js';

const doc = 'Methods\nWe enrolled 120 patients. The result was significant.\n'
    + 'Discussion\nThe result was significant in both arms, as expected.';

/** Anchor the n-th occurrence (0-based) of a phrase */
const anchorAt = (text: string, phrase: string, nth = 0) => {
    let at = -1;
    for (let i = 0; i <= nth; i++) at = text.indexOf(phrase, at + 1);
    return createAnchor(text, at, at + phrase.length)!;
};

describe('comment anchors', () => {
    it('should normalize whitespace and zero-width characters, mapping back to the original', () => {
        const { text, map } = normalize('a \u200b  b\n\nc');
        expect(text).toBe('a b c');
        expect(map).toEqual([0, 1, 5, 6, 8]);
    });

    it('should find its text again after edits elsewhere', () => {
        const anchor = anchorAt(doc, 'enrolled 120 patients');
        const edited = '# Title\n\nA new opening paragraph.\n\n' + doc.replace('Discussion', 'Discussion and limitations');
        const found = findAnchor(edited, anchor)!;
        expect(edited.slice(found.start, found.end)).toBe('enrolled 120 patients');
    });

    it('should tell repeated phrases apart by their context', () => {
        const anchor = anchorAt(doc, 'The result was significant', 1);
        const edited = 'Intro.\n' + doc;
        const found = findAnchor(edited, anchor)!;
        expect(found.start).toBe(edited.lastIndexOf('The result was significant'));
    });

    it('should report a quote that was edited away', () => {
        const anchor = anchorAt(doc, 'enrolled 120 patients');
        expect(findAnchor(doc.replace('120', '140'), anchor)).toBeNull();
    });

    it('should detach rather than jump to another occurrence of the same words', () => {
        const anchor = anchorAt(doc, 'The result was significant', 1);
        const edited = doc.replace('The result was significant in both', 'The outcome was significant in both');
        expect(findAnchor(edited, anchor)).toBeNull();
    });

    it('should keep a long quote whose surroundings both changed', () => {
        const quote = 'The result was significant in both arms, as expected';
        const anchor = anchorAt(doc, quote);
        const edited = doc.replace('Discussion\n', 'Discussion of findings\n') + ' Further work follows.';
        const found = findAnchor(edited.replace(quote + '.', quote + '!'), anchor)!;
        expect(found).not.toBeNull();
    });

    it('should attach a comment saved without context to the first occurrence', () => {
        const found = findAnchor(doc, { exact: 'The result was significant' })!;
        expect(found.start).toBe(doc.indexOf('The result was significant'));
    });

    it('should ignore whitespace and zero-width changes inside the quote', () => {
        const anchor = anchorAt(doc, 'The result was significant in both arms');
        const edited = doc.replace('significant in both', 'significant\u200b  in\nboth');
        const found = findAnchor(edited, anchor)!;
        expect(normalize(edited.slice(found.start, found.end)).text).toBe('The result was significant in both arms');
    });

    it('should cut long quotes at a word boundary', () => {
        const start = doc.indexOf('The result was significant in both');
        const anchor = createAnchor(doc, start, doc.length, 30)!;
        expect(anchor.exact).toBe('The result was significant in');
        expect(anchor.suffix.startsWith(' both arms')).toBe(true);
    });

    it('should not anchor an empty or whitespace-only range', () => {
        expect(createAnchor('a   b', 1, 4)).toBeNull();
        expect(findAnchor(doc, { exact: '  ' })).toBeNull();
    });
});
