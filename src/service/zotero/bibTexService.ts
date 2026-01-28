/**
 * BibTeX generation service for Pandoc export
 *
 * Extracts citations from markdown and generates .bib files from Zotero data
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ZoteroItem, ZoteroCreator } from './zoteroTypes';
import { ZoteroService } from './zoteroService';

/**
 * Result of BibTeX generation
 */
export interface BibTexResult {
    bibFilePath: string;
    citationsFound: string[];
    citationsMissing: string[];
}

/**
 * Map Zotero item types to BibTeX entry types
 */
function mapItemTypeToBibtex(itemType: string): string {
    const typeMap: Record<string, string> = {
        'journalArticle': 'article',
        'book': 'book',
        'bookSection': 'incollection',
        'conferencePaper': 'inproceedings',
        'thesis': 'phdthesis',
        'report': 'techreport',
        'webpage': 'online',
        'preprint': 'unpublished',
        'manuscript': 'unpublished',
        'patent': 'patent',
        'presentation': 'misc',
        'interview': 'misc',
        'film': 'misc',
        'artwork': 'misc',
        'podcast': 'misc',
        'videoRecording': 'misc',
        'audioRecording': 'misc',
        'encyclopediaArticle': 'inreference',
        'dictionaryEntry': 'inreference',
        'magazineArticle': 'article',
        'newspaperArticle': 'article',
        'letter': 'misc',
        'email': 'misc',
        'blogPost': 'online',
        'forumPost': 'online',
        'statute': 'legislation',
        'case': 'jurisdiction',
        'hearing': 'jurisdiction',
        'bill': 'legislation',
        'computerProgram': 'software',
        'map': 'misc',
        'document': 'misc'
    };
    return typeMap[itemType] || 'misc';
}

/**
 * Escape special BibTeX characters in a string
 */
function escapeBibtex(value: string): string {
    if (!value) return '';
    return value
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Format creators for BibTeX author/editor field
 */
function formatCreatorsForBibtex(creators: ZoteroCreator[], creatorType: string = 'author'): string {
    const filtered = creators.filter(c => c.creatorType === creatorType);
    const list = filtered.length > 0 ? filtered : (creatorType === 'author' ? creators : []);

    return list
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .map(c => {
            if (c.lastName && c.firstName) {
                return `${escapeBibtex(c.lastName)}, ${escapeBibtex(c.firstName)}`;
            } else if (c.lastName) {
                return escapeBibtex(c.lastName);
            }
            return '';
        })
        .filter(Boolean)
        .join(' and ');
}

/**
 * Convert a ZoteroItem to BibTeX entry string
 */
function itemToBibtex(item: ZoteroItem): string {
    const entryType = mapItemTypeToBibtex(item.itemType);
    const fields: string[] = [];

    // Required fields
    if (item.title) {
        fields.push(`  title = {${escapeBibtex(item.title)}}`);
    }

    // Authors
    const authors = formatCreatorsForBibtex(item.creators, 'author');
    if (authors) {
        fields.push(`  author = {${authors}}`);
    }

    // Editors (for books, collections)
    const editors = formatCreatorsForBibtex(item.creators, 'editor');
    if (editors) {
        fields.push(`  editor = {${editors}}`);
    }

    // Year
    if (item.year) {
        fields.push(`  year = {${item.year}}`);
    }

    // Journal/Book title
    if (item.publicationTitle) {
        if (item.itemType === 'journalArticle' || item.itemType === 'magazineArticle' || item.itemType === 'newspaperArticle') {
            fields.push(`  journal = {${escapeBibtex(item.publicationTitle)}}`);
        } else if (item.itemType === 'bookSection' || item.itemType === 'conferencePaper') {
            fields.push(`  booktitle = {${escapeBibtex(item.publicationTitle)}}`);
        }
    }

    // Volume
    if (item.volume) {
        fields.push(`  volume = {${escapeBibtex(item.volume)}}`);
    }

    // Issue/Number
    if (item.issue) {
        fields.push(`  number = {${escapeBibtex(item.issue)}}`);
    }

    // Pages
    if (item.pages) {
        fields.push(`  pages = {${escapeBibtex(item.pages)}}`);
    }

    // Publisher
    if (item.publisher) {
        fields.push(`  publisher = {${escapeBibtex(item.publisher)}}`);
    }

    // Place/Address
    if (item.place) {
        fields.push(`  address = {${escapeBibtex(item.place)}}`);
    }

    // DOI
    if (item.doi) {
        fields.push(`  doi = {${item.doi}}`);
    }

    // URL
    if (item.url) {
        fields.push(`  url = {${item.url}}`);
    }

    // ISBN
    if (item.isbn) {
        fields.push(`  isbn = {${item.isbn}}`);
    }

    // ISSN
    if (item.issn) {
        fields.push(`  issn = {${item.issn}}`);
    }

    // Abstract (optional, can be large)
    if (item.abstract) {
        fields.push(`  abstract = {${escapeBibtex(item.abstract)}}`);
    }

    return `@${entryType}{${item.citeKey},\n${fields.join(',\n')}\n}`;
}

/**
 * Extract citation keys from markdown content
 * Matches @citeKey patterns (Pandoc-style citations)
 */
export function extractCitations(markdown: string): string[] {
    // Match @citekey patterns
    // - Can start with @ or be inside brackets like [@key] or [@key1; @key2]
    // - Key can contain alphanumeric, underscore, hyphen, colon
    const regex = /@([a-zA-Z0-9_:.-]+[a-zA-Z0-9])/g;
    const matches = new Set<string>();

    let match;
    while ((match = regex.exec(markdown)) !== null) {
        matches.add(match[1]);
    }

    return Array.from(matches);
}

/**
 * Generate a BibTeX file from markdown content
 *
 * @param markdown The markdown content containing citations
 * @param outputPath Optional path for the .bib file (defaults to temp file)
 * @returns Result with file path and citation statistics
 */
export async function generateBibFile(
    markdown: string,
    outputPath?: string
): Promise<BibTexResult> {
    // Extract citation keys from markdown
    const citeKeys = extractCitations(markdown);

    if (citeKeys.length === 0) {
        // Create empty bib file
        const bibPath = outputPath || path.join(os.tmpdir(), `citations-${Date.now()}.bib`);
        await fs.writeFile(bibPath, '% No citations found\n', 'utf8');
        return {
            bibFilePath: bibPath,
            citationsFound: [],
            citationsMissing: []
        };
    }

    // Get Zotero service and fetch items
    const zoteroService = await ZoteroService.getInstanceAsync();
    await zoteroService.connectIfNeeded();
    const allItems = await zoteroService.getItems();

    // Build a map of citeKey -> item
    const itemMap = new Map<string, ZoteroItem>();
    for (const item of allItems) {
        itemMap.set(item.citeKey, item);
    }

    // Match citations with items
    const citationsFound: string[] = [];
    const citationsMissing: string[] = [];
    const bibEntries: string[] = [];

    for (const citeKey of citeKeys) {
        const item = itemMap.get(citeKey);
        if (item) {
            citationsFound.push(citeKey);
            bibEntries.push(itemToBibtex(item));
        } else {
            citationsMissing.push(citeKey);
        }
    }

    // Generate .bib file content
    const bibContent = [
        `% Generated by md-editor on ${new Date().toISOString()}`,
        `% ${citationsFound.length} citations found, ${citationsMissing.length} missing`,
        '',
        ...bibEntries
    ].join('\n\n');

    // Write to file
    const bibPath = outputPath || path.join(os.tmpdir(), `citations-${Date.now()}.bib`);
    await fs.writeFile(bibPath, bibContent, 'utf8');

    return {
        bibFilePath: bibPath,
        citationsFound,
        citationsMissing
    };
}

/**
 * Get items by citation keys (for preview or validation)
 */
export async function getItemsByCiteKeys(citeKeys: string[]): Promise<{
    found: ZoteroItem[];
    missing: string[];
}> {
    const zoteroService = await ZoteroService.getInstanceAsync();
    await zoteroService.connectIfNeeded();
    const allItems = await zoteroService.getItems();

    const itemMap = new Map<string, ZoteroItem>();
    for (const item of allItems) {
        itemMap.set(item.citeKey, item);
    }

    const found: ZoteroItem[] = [];
    const missing: string[] = [];

    for (const citeKey of citeKeys) {
        const item = itemMap.get(citeKey);
        if (item) {
            found.push(item);
        } else {
            missing.push(citeKey);
        }
    }

    return { found, missing };
}
