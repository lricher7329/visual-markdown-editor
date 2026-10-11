import { describe, it, expect, vi } from 'vitest';

// zoteroHelpers (author formatting) imports the VS Code API
vi.mock('vscode', () => ({}));

import { ZoteroSearchService, UsageStore } from '../service/zotero/zoteroSearchService';
import { ZoteroItem } from '../service/zotero/zoteroTypes';

const item = (citeKey: string, title: string): ZoteroItem => ({
    citeKey,
    title,
    year: '2020',
    itemType: 'journalArticle',
    libraryID: 1,
    zoteroKey: citeKey.toUpperCase(),
    creators: [],
    tags: [],
    collections: [],
    dateAdded: '2020-01-01',
    dateModified: '2020-01-01',
});

const items = [
    item('survey', 'A survey of networks'),
    item('graphs', 'Networks and graphs'),
    item('medicine', 'Neural networks in medicine'),
];

/** In-memory stand-in for vscode.Memento */
const memoryStore = (): UsageStore => {
    const data = new Map<string, unknown>();
    return {
        get: <T>(key: string) => data.get(key) as T | undefined,
        update: (key: string, value: unknown) => { data.set(key, value); },
    };
};

const searchKeys = (service: ZoteroSearchService, query: string, sortBy: 'relevance' | 'title') =>
    service.search(query, sortBy).map(r => r.item.citeKey);

describe('ZoteroSearchService', () => {
    it('should keep usage history in its store across instances', () => {
        const store = memoryStore();
        const first = new ZoteroSearchService(store);
        first.updateIndex(items);
        first.recordUsage('medicine');

        const second = new ZoteroSearchService(store);
        second.updateIndex(items);
        expect(searchKeys(second, '', 'relevance')[0]).toBe('medicine');
    });

    it('should not let usage or relevance override an explicit sort', () => {
        const service = new ZoteroSearchService(memoryStore());
        service.updateIndex(items);
        service.recordUsage('medicine');

        expect(searchKeys(service, 'networks', 'title')).toEqual(['survey', 'graphs', 'medicine']);
    });

    it('should save at most the 200 most recently used citations', () => {
        const store = memoryStore();
        const service = new ZoteroSearchService(store);
        for (let i = 0; i < 205; i++) {
            service.recordUsage(`key${i}`);
        }
        const saved = store.get<Record<string, unknown>>('zotero.citationUsage') ?? {};
        expect(Object.keys(saved)).toHaveLength(200);
    });
});
