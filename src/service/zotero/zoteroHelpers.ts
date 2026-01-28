/**
 * Helper functions for Zotero integration
 */
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { ZoteroCreator } from './zoteroTypes';

/**
 * Expand paths with ~ to full home directory path
 */
export function expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
        return path.join(os.homedir(), filePath.slice(2));
    }
    if (!path.isAbsolute(filePath)) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return filePath;
        }
        const workspaceFolder = workspaceFolders[0].uri.fsPath;
        return path.join(workspaceFolder, filePath);
    }
    return filePath;
}

/**
 * Format authors for display
 */
export function formatAuthors(creators: ZoteroCreator[]): string {
    const authors = creators.filter(c => c.creatorType === 'author');
    const displayCreators = authors.length > 0 ? authors : creators;

    switch (displayCreators.length) {
        case 0:
            return 'Unknown';
        case 1:
            return displayCreators[0].lastName;
        case 2:
            return `${displayCreators[0].lastName} & ${displayCreators[1].lastName}`;
        default:
            return `${displayCreators[0].lastName} et al.`;
    }
}

/**
 * Extract year from date string
 */
export function extractYear(date: string): string | null {
    const match = date.match(/(\d{4})/);
    return match ? match[1] : null;
}

/**
 * Format citation for insertion (Pandoc style for markdown)
 */
export function formatCitation(citeKey: string): string {
    return `@${citeKey}`;
}

/**
 * Get emoji icon for item type
 */
export function formatTypes(itemType: string): string {
    switch (itemType) {
        case 'book':
            return '📘';
        case 'bookSection':
            return '📖';
        case 'journalArticle':
            return '📄';
        case 'thesis':
            return '🎓';
        case 'preprint':
            return '📝';
        case 'webpage':
            return '🌐';
        case 'conferencePaper':
            return '🎤';
        case 'report':
            return '📊';
        default:
            return '📎';
    }
}

/**
 * Handle and display errors
 */
export function handleError(error: unknown, message: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`${message}: ${errorMessage}`);
}
