/**
 * Zotero citation types
 */

export interface ZoteroCreator {
    firstName: string;
    lastName: string;
    creatorType: string;
    orderIndex?: number;
}

export interface ZoteroItem {
    citeKey: string;
    title: string;
    date?: string;
    year: string | null;
    itemType: string;
    libraryID: number;
    zoteroKey: string;
    creators: ZoteroCreator[];
    // Extended fields for improved search
    abstract?: string;
    publicationTitle?: string;  // journal, book title, etc.
    doi?: string;
    tags: string[];
    collections: string[];
    dateAdded: string;
    dateModified: string;
    // Additional BibTeX fields
    volume?: string;
    issue?: string;
    pages?: string;
    publisher?: string;
    place?: string;
    url?: string;
    isbn?: string;
    issn?: string;
}

export interface ZoteroOpenOption {
    type: 'pdf' | 'zotero' | 'doi';
    key: string;
}

export interface ZoteroDatabaseOptions {
    zoteroDbPath: string;
    betterBibtexDbPath: string;
    linkedAttachmentsBasePath?: string;
}

export interface ZoteroLibrary {
    libraryID: number;
    type: 'user' | 'group';
    editable: boolean;
    filesEditable: boolean;
}

export type LibraryFilter = 'all' | 'personal' | 'group';
