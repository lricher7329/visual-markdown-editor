/**
 * Comment anchors: the quoted text plus a little context on each side, so a
 * comment can find its text again after edits elsewhere in the document
 * (the TextQuoteSelector model from W3C Web Annotation).
 *
 * Pure functions over plain strings; util.js maps them to the editor's DOM.
 */

const CONTEXT_LENGTH = 32;
// Below this many matching context characters, an occurrence may be other text
const MIN_CONTEXT_MATCH = 5;
// Quotes this long are distinctive enough to trust without context
const TRUSTED_QUOTE_LENGTH = 40;
const ZERO_WIDTH = /[\u200b\u200c\u200d\ufeff]/;
const WHITESPACE = /\s/;

/**
 * Collapse whitespace runs to one space and drop zero-width characters
 * (Vditor inserts U+200B around inline elements). `map[i]` is the index in
 * `text` of the i-th normalized character.
 */
export function normalize(text) {
    let out = '';
    const map = [];
    let lastWasSpace = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ZERO_WIDTH.test(ch)) continue;
        const isSpace = WHITESPACE.test(ch);
        if (isSpace && lastWasSpace) continue;
        out += isSpace ? ' ' : ch;
        map.push(i);
        lastWasSpace = isSpace;
    }
    return { text: out, map };
}

/**
 * Build an anchor for text[start, end). A long quote is cut at a word
 * boundary near `maxLength`, so paragraph-wide anchors stay robust to edits
 * near their end. Returns null when the range holds no visible text.
 */
export function createAnchor(text, start, end, maxLength = Infinity) {
    const { text: norm, map } = normalize(text);
    let s = 0;
    while (s < map.length && map[s] < start) s++;
    let e = s;
    while (e < map.length && map[e] < end) e++;
    while (s < e && norm[s] === ' ') s++;
    while (e > s && norm[e - 1] === ' ') e--;
    if (e - s > maxLength) {
        const cut = norm.lastIndexOf(' ', s + maxLength);
        e = cut > s + maxLength / 2 ? cut : s + maxLength;
    }
    if (s === e) return null;
    return {
        exact: norm.slice(s, e),
        prefix: norm.slice(Math.max(0, s - CONTEXT_LENGTH), s),
        suffix: norm.slice(e, e + CONTEXT_LENGTH),
    };
}

/**
 * Find an anchor in text. Among several occurrences of the quote, the one
 * whose surroundings best match the saved context wins. Returns the range
 * in `text` indices, or null when the quote is gone, or when the only
 * occurrences left share almost none of the saved context (the commented
 * text was likely edited and these are other instances of the same words).
 */
export function findAnchor(text, anchor) {
    const exact = anchor && normalize(anchor.exact || '').text.trim();
    if (!exact) return null;
    const prefix = normalize(anchor.prefix || '').text;
    const suffix = normalize(anchor.suffix || '').text;
    const { text: norm, map } = normalize(text);

    let best = -1;
    let bestScore = -1;
    for (let at = norm.indexOf(exact); at !== -1; at = norm.indexOf(exact, at + 1)) {
        const before = norm.slice(Math.max(0, at - prefix.length), at);
        const after = norm.slice(at + exact.length, at + exact.length + suffix.length);
        const score = commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix);
        if (score > bestScore) {
            best = at;
            bestScore = score;
        }
    }
    if (best === -1) return null;
    // Anchors saved without context (comments from before 1.1) and long quotes are trusted
    const hasContext = prefix.length + suffix.length > 0;
    if (hasContext && bestScore < MIN_CONTEXT_MATCH && exact.length < TRUSTED_QUOTE_LENGTH) return null;
    return { start: map[best], end: map[best + exact.length - 1] + 1 };
}

function commonPrefixLength(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n;
}

function commonSuffixLength(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
    return n;
}
