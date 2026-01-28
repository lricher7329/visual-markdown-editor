/**
 * Zotero search service with fuzzy matching, search operators, and ranking
 */
import Fuse, { IFuseOptions, FuseResultMatch } from 'fuse.js';
import { ZoteroItem } from './zoteroTypes';
import { formatAuthors } from './zoteroHelpers';

export interface SearchOperators {
    author?: string;
    year?: string;
    tag?: string;
    journal?: string;
    collection?: string;
    type?: string;
    freeText: string;
}

export interface SearchResult {
    item: ZoteroItem;
    score: number;  // Lower is better (fuse.js convention)
    matches?: ReadonlyArray<FuseResultMatch>;
}

export type SortOption = 'relevance' | 'dateAdded' | 'dateModified' | 'year' | 'title' | 'author';

export class ZoteroSearchService {
    private fuse: Fuse<ZoteroItem> | null = null;
    private items: ZoteroItem[] = [];
    private usageHistory: Map<string, { count: number; lastUsed: Date }> = new Map();

    private static readonly FUSE_OPTIONS: IFuseOptions<ZoteroItem> = {
        keys: [
            { name: 'title', weight: 0.3 },
            { name: 'citeKey', weight: 0.25 },
            { name: 'abstract', weight: 0.15 },
            { name: 'publicationTitle', weight: 0.1 },
            { name: 'creators.lastName', weight: 0.1 },
            { name: 'creators.firstName', weight: 0.05 },
            { name: 'tags', weight: 0.03 },
            { name: 'collections', weight: 0.02 }
        ],
        threshold: 0.4,  // 0 = exact match, 1 = match anything
        distance: 100,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
        useExtendedSearch: true,
        ignoreLocation: true
    };

    /**
     * Update the search index with new items
     */
    public updateIndex(items: ZoteroItem[]): void {
        this.items = items;
        this.fuse = new Fuse(items, ZoteroSearchService.FUSE_OPTIONS);
    }

    /**
     * Parse search query for operators (author:, year:, tag:, etc.)
     */
    public parseSearchQuery(query: string): SearchOperators {
        const operators: SearchOperators = { freeText: '' };

        // Match operator patterns: operator:value or operator:"value with spaces"
        const operatorRegex = /(\w+):(?:"([^"]+)"|(\S+))/g;
        let freeText = query;

        let match;
        while ((match = operatorRegex.exec(query)) !== null) {
            const [fullMatch, operator, quotedValue, unquotedValue] = match;
            const value = quotedValue || unquotedValue;

            switch (operator.toLowerCase()) {
                case 'author':
                case 'a':
                    operators.author = value;
                    break;
                case 'year':
                case 'y':
                    operators.year = value;
                    break;
                case 'tag':
                case 't':
                    operators.tag = value;
                    break;
                case 'journal':
                case 'j':
                case 'publication':
                    operators.journal = value;
                    break;
                case 'collection':
                case 'c':
                    operators.collection = value;
                    break;
                case 'type':
                    operators.type = value;
                    break;
            }

            freeText = freeText.replace(fullMatch, '');
        }

        // Strip incomplete operators (e.g., "author:" with no value) from free text
        freeText = freeText.replace(/\b(author|a|year|y|tag|t|journal|j|publication|collection|c|type):\s*/gi, '');

        operators.freeText = freeText.trim();
        return operators;
    }

    /**
     * Check if an item matches the given operators
     */
    private matchesOperators(item: ZoteroItem, operators: SearchOperators): boolean {
        if (operators.author) {
            const authorLower = operators.author.toLowerCase();
            const hasAuthor = item.creators.some(c =>
                c.lastName?.toLowerCase().includes(authorLower) ||
                c.firstName?.toLowerCase().includes(authorLower)
            );
            if (!hasAuthor) return false;
        }

        if (operators.year) {
            if (item.year !== operators.year) return false;
        }

        if (operators.tag) {
            const tagLower = operators.tag.toLowerCase();
            const hasTag = item.tags.some(t => t.toLowerCase().includes(tagLower));
            if (!hasTag) return false;
        }

        if (operators.journal) {
            const journalLower = operators.journal.toLowerCase();
            if (!item.publicationTitle?.toLowerCase().includes(journalLower)) return false;
        }

        if (operators.collection) {
            const collectionLower = operators.collection.toLowerCase();
            const hasCollection = item.collections.some(c => c.toLowerCase().includes(collectionLower));
            if (!hasCollection) return false;
        }

        if (operators.type) {
            const typeLower = operators.type.toLowerCase();
            if (!item.itemType.toLowerCase().includes(typeLower)) return false;
        }

        return true;
    }

    /**
     * Search items with fuzzy matching and operator support
     */
    public search(query: string, sortBy: SortOption = 'relevance', limit?: number): SearchResult[] {
        if (!this.fuse || this.items.length === 0) {
            return [];
        }

        const operators = this.parseSearchQuery(query);
        let results: SearchResult[];

        if (operators.freeText) {
            // Use fuse.js for fuzzy search on free text
            const fuseResults = this.fuse.search(operators.freeText);
            results = fuseResults
                .filter(r => this.matchesOperators(r.item, operators))
                .map(r => ({
                    item: r.item,
                    score: r.score || 0,
                    matches: r.matches
                }));
        } else if (this.hasOperators(operators)) {
            // Only operators, no free text - filter all items
            results = this.items
                .filter(item => this.matchesOperators(item, operators))
                .map(item => ({
                    item,
                    score: 0,
                    matches: undefined
                }));
        } else {
            // No query at all - return all items
            results = this.items.map(item => ({
                item,
                score: 0,
                matches: undefined
            }));
        }

        // Apply sorting
        results = this.sortResults(results, sortBy);

        // Apply usage boost (recently/frequently used items get priority)
        results = this.applyUsageBoost(results);

        // Apply limit
        if (limit && limit > 0) {
            results = results.slice(0, limit);
        }

        return results;
    }

    /**
     * Check if any operators are present
     */
    private hasOperators(operators: SearchOperators): boolean {
        return !!(operators.author || operators.year || operators.tag ||
                  operators.journal || operators.collection || operators.type);
    }

    /**
     * Sort results by the specified option
     */
    private sortResults(results: SearchResult[], sortBy: SortOption): SearchResult[] {
        switch (sortBy) {
            case 'relevance':
                // Already sorted by fuse score, just ensure stable sort
                return results.sort((a, b) => a.score - b.score);

            case 'dateAdded':
                return results.sort((a, b) =>
                    new Date(b.item.dateAdded).getTime() - new Date(a.item.dateAdded).getTime()
                );

            case 'dateModified':
                return results.sort((a, b) =>
                    new Date(b.item.dateModified).getTime() - new Date(a.item.dateModified).getTime()
                );

            case 'year':
                return results.sort((a, b) => {
                    const yearA = parseInt(a.item.year || '0');
                    const yearB = parseInt(b.item.year || '0');
                    return yearB - yearA;  // Newest first
                });

            case 'title':
                return results.sort((a, b) =>
                    a.item.title.localeCompare(b.item.title)
                );

            case 'author':
                return results.sort((a, b) => {
                    const authorA = formatAuthors(a.item.creators);
                    const authorB = formatAuthors(b.item.creators);
                    return authorA.localeCompare(authorB);
                });

            default:
                return results;
        }
    }

    /**
     * Boost recently/frequently used items in results
     */
    private applyUsageBoost(results: SearchResult[]): SearchResult[] {
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        return results.sort((a, b) => {
            const usageA = this.usageHistory.get(a.item.citeKey);
            const usageB = this.usageHistory.get(b.item.citeKey);

            // Calculate usage score (higher is better)
            const getUsageScore = (usage: { count: number; lastUsed: Date } | undefined): number => {
                if (!usage) return 0;
                const recencyScore = Math.max(0, 1 - (now - usage.lastUsed.getTime()) / (7 * ONE_DAY));
                return usage.count * 0.5 + recencyScore * 0.5;
            };

            const usageScoreA = getUsageScore(usageA);
            const usageScoreB = getUsageScore(usageB);

            // If both have usage history, compare by usage
            if (usageScoreA > 0 || usageScoreB > 0) {
                const usageDiff = usageScoreB - usageScoreA;
                if (Math.abs(usageDiff) > 0.1) {
                    return usageDiff;
                }
            }

            // Fall back to original score
            return a.score - b.score;
        });
    }

    /**
     * Record that an item was used (for ranking boost)
     */
    public recordUsage(citeKey: string): void {
        const existing = this.usageHistory.get(citeKey);
        if (existing) {
            existing.count++;
            existing.lastUsed = new Date();
        } else {
            this.usageHistory.set(citeKey, { count: 1, lastUsed: new Date() });
        }
    }

    /**
     * Get all items (for when no search is active)
     */
    public getAllItems(): ZoteroItem[] {
        return this.items;
    }

    /**
     * Check if the index is populated
     */
    public hasIndex(): boolean {
        return this.items.length > 0;
    }

    /**
     * Get search help text for display
     */
    public static getSearchHelpText(): string {
        return [
            'Search operators:',
            '  author:Smith or a:Smith - Filter by author name',
            '  year:2024 or y:2024 - Filter by publication year',
            '  tag:important or t:important - Filter by tag',
            '  journal:Nature or j:Nature - Filter by journal/publication',
            '  collection:Research or c:Research - Filter by collection',
            '  type:article - Filter by item type',
            '',
            'Use quotes for multi-word values: author:"John Smith"',
            'Combine operators: author:Smith year:2024 machine learning'
        ].join('\n');
    }
}
