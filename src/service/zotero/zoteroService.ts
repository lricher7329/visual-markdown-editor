/**
 * Zotero database service for citation management
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import initSqlJs, { Database, QueryExecResult } from 'sql.js';
import {
    queryBbt,
    queryItems,
    queryCreators,
    queryTags,
    queryCollections,
    queryZoteroKey,
    queryPdfByZoteroKey,
    queryDoiByZoteroKey,
    queryLibraries,
    queryAttachmentPath
} from './zoteroQueries';
import {
    handleError,
    extractYear,
    expandPath
} from './zoteroHelpers';
import { detectZoteroPaths } from './zoteroDetect';
import { ZoteroItem, ZoteroOpenOption, ZoteroDatabaseOptions, ZoteroLibrary, LibraryFilter } from './zoteroTypes';
import { zoteroLogger } from './zoteroLogger';

export class ZoteroService {
    private static instance: ZoteroService | null = null;
    private static extensionPath: string = '';
    private static initPromise: Promise<ZoteroService> | null = null;
    private db: Database | null = null;
    private bbt: Database | null = null;
    private options: ZoteroDatabaseOptions;
    private libraries: Map<number, ZoteroLibrary> = new Map();
    private lastItemCount: number = 0;

    // Caching
    private cachedItems: ZoteroItem[] | null = null;
    private cacheTimestamp: number = 0;

    private constructor(options: ZoteroDatabaseOptions) {
        this.options = options;
    }

    /**
     * Check if the cache is still valid
     */
    private isCacheValid(): boolean {
        if (!this.cachedItems) return false;
        const config = vscode.workspace.getConfiguration('document-viewer');
        const ttl = config.get<number>('zotero.cacheTtlMinutes', 5) * 60 * 1000;
        return Date.now() - this.cacheTimestamp < ttl;
    }

    /**
     * Invalidate the cache (call after refresh or config changes)
     */
    public invalidateCache(): void {
        this.cachedItems = null;
        this.cacheTimestamp = 0;
        zoteroLogger.debug('Cache invalidated');
    }

    /**
     * Set the extension path (call this during extension activation)
     */
    public static setExtensionPath(extensionPath: string): void {
        ZoteroService.extensionPath = extensionPath;
    }

    /**
     * Get singleton instance of ZoteroService (async for auto-detection)
     */
    public static async getInstanceAsync(): Promise<ZoteroService> {
        if (ZoteroService.instance) {
            return ZoteroService.instance;
        }

        // Prevent multiple concurrent initializations
        if (ZoteroService.initPromise) {
            return ZoteroService.initPromise;
        }

        ZoteroService.initPromise = ZoteroService.createInstance();
        try {
            ZoteroService.instance = await ZoteroService.initPromise;
            return ZoteroService.instance;
        } finally {
            ZoteroService.initPromise = null;
        }
    }

    /**
     * Create a new instance with auto-detection or manual config
     */
    private static async createInstance(): Promise<ZoteroService> {
        const config = vscode.workspace.getConfiguration('document-viewer');
        const autoDetect = config.get<boolean>('zotero.autoDetect', true);
        const linkedAttachmentsBasePath = config.get<string>('zotero.linkedAttachmentsBasePath', '');

        zoteroLogger.info('Creating ZoteroService instance');
        zoteroLogger.setStatus({ status: 'connecting', message: 'Detecting Zotero installation...' });

        let options: ZoteroDatabaseOptions;

        if (autoDetect) {
            zoteroLogger.info('Auto-detection enabled, searching for Zotero...');
            const detected = await detectZoteroPaths();

            if (detected.zoteroDbPath && detected.betterBibtexDbPath) {
                zoteroLogger.info(`Zotero found at: ${detected.dataDir} (source: ${detected.source})`);
                options = {
                    zoteroDbPath: detected.zoteroDbPath,
                    betterBibtexDbPath: detected.betterBibtexDbPath,
                    linkedAttachmentsBasePath: linkedAttachmentsBasePath ? expandPath(linkedAttachmentsBasePath) : undefined
                };
            } else if (detected.zoteroDbPath) {
                // Zotero found but BBT missing - show warning
                zoteroLogger.warn(detected.error || 'Better BibTeX not found');
                vscode.window.showWarningMessage(
                    detected.error || 'Better BibTeX not found. Citation keys require the Better BibTeX plugin.'
                );
                options = {
                    zoteroDbPath: detected.zoteroDbPath,
                    betterBibtexDbPath: expandPath(config.get('zotero.betterBibtexDbPath', '~/Zotero/better-bibtex.sqlite')),
                    linkedAttachmentsBasePath: linkedAttachmentsBasePath ? expandPath(linkedAttachmentsBasePath) : undefined
                };
            } else {
                // Detection failed, fall back to manual paths
                zoteroLogger.error(`Auto-detection failed: ${detected.error || 'Unknown error'}`);
                vscode.window.showWarningMessage(
                    `Zotero auto-detection failed: ${detected.error || 'Unknown error'}. Using manual paths.`
                );
                options = {
                    zoteroDbPath: expandPath(config.get('zotero.zoteroDbPath', '~/Zotero/zotero.sqlite')),
                    betterBibtexDbPath: expandPath(config.get('zotero.betterBibtexDbPath', '~/Zotero/better-bibtex.sqlite')),
                    linkedAttachmentsBasePath: linkedAttachmentsBasePath ? expandPath(linkedAttachmentsBasePath) : undefined
                };
            }
        } else {
            // Manual configuration
            zoteroLogger.info('Using manual configuration');
            options = {
                zoteroDbPath: expandPath(config.get('zotero.zoteroDbPath', '~/Zotero/zotero.sqlite')),
                betterBibtexDbPath: expandPath(config.get('zotero.betterBibtexDbPath', '~/Zotero/better-bibtex.sqlite')),
                linkedAttachmentsBasePath: linkedAttachmentsBasePath ? expandPath(linkedAttachmentsBasePath) : undefined
            };
        }

        zoteroLogger.info(`Database paths: zotero=${options.zoteroDbPath}, bbt=${options.betterBibtexDbPath}`);
        if (options.linkedAttachmentsBasePath) {
            zoteroLogger.info(`Linked attachments base path: ${options.linkedAttachmentsBasePath}`);
        }

        return new ZoteroService(options);
    }

    /**
     * Get singleton instance of ZoteroService (sync, for backwards compatibility)
     * @deprecated Use getInstanceAsync() instead for auto-detection support
     */
    public static getInstance(): ZoteroService {
        if (!ZoteroService.instance) {
            const config = vscode.workspace.getConfiguration('document-viewer');
            const options: ZoteroDatabaseOptions = {
                zoteroDbPath: expandPath(config.get('zotero.zoteroDbPath', '~/Zotero/zotero.sqlite')),
                betterBibtexDbPath: expandPath(config.get('zotero.betterBibtexDbPath', '~/Zotero/better-bibtex.sqlite'))
            };
            ZoteroService.instance = new ZoteroService(options);
        }
        return ZoteroService.instance;
    }

    /**
     * Reset singleton instance (useful when config changes)
     */
    public static resetInstance(): void {
        if (ZoteroService.instance) {
            ZoteroService.instance.close();
            ZoteroService.instance = null;
        }
        ZoteroService.initPromise = null;
    }

    /**
     * Get the current database paths (for display in detect command)
     */
    public getDatabasePaths(): ZoteroDatabaseOptions {
        return { ...this.options };
    }

    /**
     * Check if Zotero is currently running (database might be locked)
     */
    private async checkDatabaseLock(): Promise<{ locked: boolean; warning: string | null }> {
        const walPath = this.options.zoteroDbPath + '-wal';
        const shmPath = this.options.zoteroDbPath + '-shm';

        try {
            // Check for WAL/SHM files which indicate Zotero might be running
            const [walExists, shmExists] = await Promise.all([
                fs.access(walPath).then(() => true).catch(() => false),
                fs.access(shmPath).then(() => true).catch(() => false)
            ]);

            if (walExists || shmExists) {
                // WAL files exist - Zotero is likely running or was recently closed
                // We can still read the database, but it might be slightly stale
                return {
                    locked: false,
                    warning: 'Zotero appears to be running. Citations will work but may not include the most recent changes. Close Zotero or use "Refresh Zotero Library" to see latest items.'
                };
            }

            return { locked: false, warning: null };
        } catch {
            return { locked: false, warning: null };
        }
    }

    /**
     * Connect to Zotero and Better BibTeX databases
     */
    public async connect(): Promise<boolean> {
        zoteroLogger.info('Connecting to Zotero databases...');
        zoteroLogger.setStatus({ status: 'connecting', message: 'Connecting to databases...' });

        try {
            // Check if files exist
            await fs.access(this.options.zoteroDbPath);
            await fs.access(this.options.betterBibtexDbPath);

            // Check for database lock (Zotero running)
            const lockCheck = await this.checkDatabaseLock();
            if (lockCheck.warning) {
                zoteroLogger.warn(lockCheck.warning);
                zoteroLogger.setStatus({ status: 'warning', message: lockCheck.warning });
            }

            // Initialize sql.js with the WASM file from the extension's output directory
            const wasmPath = ZoteroService.extensionPath
                ? path.join(ZoteroService.extensionPath, 'out', 'sql-wasm.wasm')
                : undefined;

            const SQL = await initSqlJs({
                locateFile: (file: string) => wasmPath || file
            });
            const zoteroDbFile = await fs.readFile(this.options.zoteroDbPath);
            const bbtDbFile = await fs.readFile(this.options.betterBibtexDbPath);

            this.db = new SQL.Database(zoteroDbFile);
            this.bbt = new SQL.Database(bbtDbFile);

            // Load library information
            await this.loadLibraries();

            zoteroLogger.info('Successfully connected to Zotero databases');
            if (!lockCheck.warning) {
                zoteroLogger.setStatus({ status: 'connected', message: 'Connected to Zotero' });
            }

            return true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            zoteroLogger.error(`Failed to connect: ${errorMsg}`);
            zoteroLogger.setStatus({ status: 'error', message: `Connection failed: ${errorMsg}` });

            if (error instanceof Error) {
                if ('code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                    const filePath = 'path' in error ? (error as NodeJS.ErrnoException).path : '';
                    vscode.window.showErrorMessage(`Zotero database file not found at ${filePath}. Please check your Zotero installation and settings.`);
                } else {
                    handleError(error, 'Failed to connect to Zotero databases');
                }
            } else {
                handleError(error, 'Failed to connect to Zotero databases');
            }
            return false;
        }
    }

    /**
     * Load library information from the database
     */
    private async loadLibraries(): Promise<void> {
        if (!this.db) return;

        try {
            const result = this.db.exec(queryLibraries);
            if (result.length > 0) {
                const { columns, values } = result[0];
                const idIndex = columns.indexOf('libraryID');
                const typeIndex = columns.indexOf('type');
                const editableIndex = columns.indexOf('editable');
                const filesEditableIndex = columns.indexOf('filesEditable');

                this.libraries.clear();
                for (const row of values) {
                    const libraryID = row[idIndex] as number;
                    this.libraries.set(libraryID, {
                        libraryID,
                        type: row[typeIndex] as 'user' | 'group',
                        editable: Boolean(row[editableIndex]),
                        filesEditable: Boolean(row[filesEditableIndex])
                    });
                }
                zoteroLogger.debug(`Loaded ${this.libraries.size} libraries`);
            }
        } catch (error) {
            zoteroLogger.warn(`Failed to load libraries: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Connect if not already connected
     */
    public async connectIfNeeded(): Promise<boolean> {
        if (!this.db || !this.bbt) {
            return await this.connect();
        }
        return true;
    }

    /**
     * Get all items from Zotero database
     * @param filter Optional library filter
     */
    public async getItems(filter?: LibraryFilter, bypassCache: boolean = false): Promise<ZoteroItem[]> {
        if (!this.db || !this.bbt) {
            zoteroLogger.error('Attempted to get items but database not connected');
            vscode.window.showErrorMessage('Zotero database not connected');
            return [];
        }

        // Get filter from config if not provided
        if (!filter) {
            const config = vscode.workspace.getConfiguration('document-viewer');
            filter = config.get<LibraryFilter>('zotero.libraryFilter', 'all');
        }

        // Check cache first (only for 'all' filter to keep it simple)
        if (!bypassCache && filter === 'all' && this.isCacheValid()) {
            zoteroLogger.debug(`Returning ${this.cachedItems!.length} cached items`);
            return this.cachedItems!;
        }

        zoteroLogger.debug(`Getting items with filter: ${filter}`);

        try {
            // Execute queries
            const [sqlBbt, sqlItems, sqlCreators, sqlTags, sqlCollections] = [
                this.bbt.exec(queryBbt),
                this.db.exec(queryItems),
                this.db.exec(queryCreators),
                this.db.exec(queryTags),
                this.db.exec(queryCollections)
            ];

            // Process Better BibTeX citation keys
            const bbtCitekeys: Record<string, string> = {};
            if (sqlBbt.length > 0) {
                const { columns, values } = sqlBbt[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const citeKeyIndex = columns.indexOf('citeKey');
                for (const row of values) {
                    bbtCitekeys[row[zoteroKeyIndex] as string] = row[citeKeyIndex] as string;
                }
            }

            // Process items (with extended fields)
            const rawItems: Record<string, Partial<ZoteroItem> & { tags: string[]; collections: string[] }> = {};
            if (sqlItems.length > 0) {
                const { columns, values } = sqlItems[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const fieldNameIndex = columns.indexOf('fieldName');
                const valueIndex = columns.indexOf('value');
                const typeNameIndex = columns.indexOf('typeName');
                const libraryIdIndex = columns.indexOf('libraryID');
                const dateAddedIndex = columns.indexOf('dateAdded');
                const dateModifiedIndex = columns.indexOf('dateModified');

                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    if (!rawItems[zoteroKey]) {
                        rawItems[zoteroKey] = {
                            creators: [],
                            tags: [],
                            collections: [],
                            zoteroKey: zoteroKey,
                            dateAdded: row[dateAddedIndex] as string || '',
                            dateModified: row[dateModifiedIndex] as string || ''
                        };
                    }

                    const fieldName = row[fieldNameIndex] as string;
                    const value = row[valueIndex] as string;
                    switch (fieldName) {
                        case 'title':
                            rawItems[zoteroKey].title = value;
                            break;
                        case 'date':
                            rawItems[zoteroKey].date = value;
                            break;
                        case 'abstractNote':
                            rawItems[zoteroKey].abstract = value;
                            break;
                        case 'publicationTitle':
                        case 'bookTitle':
                        case 'proceedingsTitle':
                            // Use first non-empty publication title found
                            if (!rawItems[zoteroKey].publicationTitle) {
                                rawItems[zoteroKey].publicationTitle = value;
                            }
                            break;
                        case 'DOI':
                            rawItems[zoteroKey].doi = value;
                            break;
                        case 'volume':
                            rawItems[zoteroKey].volume = value;
                            break;
                        case 'issue':
                            rawItems[zoteroKey].issue = value;
                            break;
                        case 'pages':
                            rawItems[zoteroKey].pages = value;
                            break;
                        case 'publisher':
                            rawItems[zoteroKey].publisher = value;
                            break;
                        case 'place':
                            rawItems[zoteroKey].place = value;
                            break;
                        case 'url':
                            rawItems[zoteroKey].url = value;
                            break;
                        case 'ISBN':
                            rawItems[zoteroKey].isbn = value;
                            break;
                        case 'ISSN':
                            rawItems[zoteroKey].issn = value;
                            break;
                    }
                    rawItems[zoteroKey].itemType = row[typeNameIndex] as string;
                    rawItems[zoteroKey].libraryID = row[libraryIdIndex] as number;
                }
            }

            // Process creators
            if (sqlCreators.length > 0) {
                const { columns, values } = sqlCreators[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const orderIndexIndex = columns.indexOf('orderIndex');
                const firstNameIndex = columns.indexOf('firstName');
                const lastNameIndex = columns.indexOf('lastName');
                const creatorTypeIndex = columns.indexOf('creatorType');

                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    if (rawItems[zoteroKey]) {
                        const orderIndex = row[orderIndexIndex] as number;
                        rawItems[zoteroKey].creators![orderIndex] = {
                            firstName: row[firstNameIndex] as string,
                            lastName: row[lastNameIndex] as string,
                            creatorType: row[creatorTypeIndex] as string,
                            orderIndex: orderIndex
                        };
                    }
                }
            }

            // Process tags
            if (sqlTags.length > 0) {
                const { columns, values } = sqlTags[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const tagNameIndex = columns.indexOf('tagName');

                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    const tagName = row[tagNameIndex] as string;
                    if (rawItems[zoteroKey] && tagName) {
                        rawItems[zoteroKey].tags.push(tagName);
                    }
                }
            }

            // Process collections
            if (sqlCollections.length > 0) {
                const { columns, values } = sqlCollections[0];
                const zoteroKeyIndex = columns.indexOf('zoteroKey');
                const collectionNameIndex = columns.indexOf('collectionName');

                for (const row of values) {
                    const zoteroKey = row[zoteroKeyIndex] as string;
                    const collectionName = row[collectionNameIndex] as string;
                    if (rawItems[zoteroKey] && collectionName) {
                        rawItems[zoteroKey].collections.push(collectionName);
                    }
                }
            }

            // Build final items array with citeKeys, applying library filter
            const items: ZoteroItem[] = [];
            for (const [zoteroKey, item] of Object.entries(rawItems)) {
                const citeKey = bbtCitekeys[zoteroKey];
                if (citeKey && item.title) {
                    // Apply library filter
                    if (filter !== 'all' && item.libraryID) {
                        const library = this.libraries.get(item.libraryID);
                        if (library) {
                            if (filter === 'personal' && library.type !== 'user') continue;
                            if (filter === 'group' && library.type !== 'group') continue;
                        }
                    }

                    items.push({
                        citeKey,
                        title: item.title,
                        date: item.date,
                        year: extractYear(item.date || ''),
                        itemType: item.itemType || 'document',
                        libraryID: item.libraryID || 1,
                        zoteroKey,
                        creators: (item.creators || []).filter(Boolean),
                        abstract: item.abstract,
                        publicationTitle: item.publicationTitle,
                        doi: item.doi,
                        tags: item.tags || [],
                        collections: item.collections || [],
                        dateAdded: item.dateAdded || '',
                        dateModified: item.dateModified || '',
                        volume: item.volume,
                        issue: item.issue,
                        pages: item.pages,
                        publisher: item.publisher,
                        place: item.place,
                        url: item.url,
                        isbn: item.isbn,
                        issn: item.issn
                    });
                }
            }

            // Update status with item count
            this.lastItemCount = items.length;
            const currentStatus = zoteroLogger.getStatus();
            if (currentStatus.status === 'connected' || currentStatus.status === 'warning') {
                zoteroLogger.setStatus({
                    ...currentStatus,
                    itemCount: items.length,
                    message: currentStatus.status === 'warning' ? currentStatus.message : `Connected - ${items.length} items`
                });
            }

            zoteroLogger.info(`Loaded ${items.length} items from Zotero`);

            // Update cache (only for 'all' filter)
            if (filter === 'all') {
                this.cachedItems = items;
                this.cacheTimestamp = Date.now();
                zoteroLogger.debug('Items cached');
            }

            return items;
        } catch (error) {
            zoteroLogger.error(`Error querying Zotero database: ${error instanceof Error ? error.message : String(error)}`);
            handleError(error, 'Error querying Zotero database');
            return [];
        }
    }

    /**
     * Get open options for a citation (PDF, Zotero, DOI)
     */
    public getOpenOptions(citeKey: string): ZoteroOpenOption[] {
        if (!this.db || !this.bbt) {
            vscode.window.showErrorMessage('Zotero database not connected');
            return [];
        }

        const sqlZoteroKey = this.bbt.exec(queryZoteroKey(citeKey));
        const zoteroKey = this.getFirstValue(sqlZoteroKey, 'zoteroKey');

        if (!zoteroKey) {
            vscode.window.showErrorMessage(`Could not find Zotero key for ${citeKey}`);
            return [];
        }

        const options: ZoteroOpenOption[] = [];
        options.push({ type: 'zotero', key: zoteroKey });

        const sqlPdf = this.db.exec(queryPdfByZoteroKey(zoteroKey));
        const pdfKey = this.getFirstValue(sqlPdf, 'pdfKey');

        if (pdfKey) {
            options.push({ type: 'pdf', key: pdfKey });
        }

        const sqlDoi = this.db.exec(queryDoiByZoteroKey(zoteroKey));
        const doi = this.getFirstValue(sqlDoi, 'value');

        if (doi) {
            options.push({ type: 'doi', key: doi });
        }

        return options;
    }

    /**
     * Get the full path for an attachment, handling linked files
     */
    public getAttachmentPath(pdfKey: string): string | null {
        if (!this.db) return null;

        try {
            const result = this.db.exec(queryAttachmentPath(pdfKey));
            if (result.length === 0) return null;

            const { columns, values } = result[0];
            if (values.length === 0) return null;

            const pathIndex = columns.indexOf('path');
            const linkModeIndex = columns.indexOf('linkMode');

            const attachmentPath = values[0][pathIndex] as string;
            const linkMode = values[0][linkModeIndex] as number;

            // linkMode: 0 = imported file, 1 = imported URL, 2 = linked file, 3 = linked URL
            if (linkMode === 2 && attachmentPath) {
                // Linked file - might be relative to base path
                if (this.options.linkedAttachmentsBasePath && !path.isAbsolute(attachmentPath)) {
                    return path.join(this.options.linkedAttachmentsBasePath, attachmentPath);
                }
                return attachmentPath;
            } else if (linkMode === 0 && attachmentPath) {
                // Stored file - path is relative to storage folder
                // Format is usually "storage:filename.pdf"
                const storagePath = attachmentPath.replace('storage:', '');
                const dataDir = path.dirname(this.options.zoteroDbPath);
                return path.join(dataDir, 'storage', pdfKey, storagePath);
            }

            return null;
        } catch (error) {
            zoteroLogger.warn(`Failed to get attachment path for ${pdfKey}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Refresh the database connection (re-read database files)
     */
    public async refresh(): Promise<boolean> {
        zoteroLogger.info('Refreshing Zotero database connection...');
        this.invalidateCache();
        this.close();
        return await this.connect();
    }

    /**
     * Close database connections
     */
    public close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        if (this.bbt) {
            this.bbt.close();
            this.bbt = null;
        }

        this.libraries.clear();
        zoteroLogger.info('Disconnected from Zotero databases');
        zoteroLogger.setStatus({ status: 'disconnected', message: 'Disconnected' });
    }

    /**
     * Check if connected to databases
     */
    public isConnected(): boolean {
        return this.db !== null && this.bbt !== null;
    }

    /**
     * Get the last known item count
     */
    public getItemCount(): number {
        return this.lastItemCount;
    }

    /**
     * Get the first value from a SQL result set
     */
    private getFirstValue(sqlResult: QueryExecResult[], columnName: string): string | null {
        if (sqlResult.length === 0) {
            return null;
        }
        const { columns, values } = sqlResult[0];
        const columnIndex = columns.indexOf(columnName);

        if (columnIndex === -1 || values.length === 0) {
            return null;
        }
        return values[0][columnIndex] as string;
    }
}
