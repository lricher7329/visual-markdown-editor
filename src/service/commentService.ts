import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';
import { Output } from '@/common/Output';

export interface Comment {
    id: string;
    line: number;
    text: string;
    selectedText?: string;
    timestamp: string;
}

interface CommentFile {
    version: "1.0";
    comments: Comment[];
}

/**
 * Service for managing markdown document comments stored in sidecar files.
 * Comments are stored in a .comments file alongside the markdown file.
 */
export class CommentService {

    /**
     * Get the path to the comments file for a document
     */
    static getCommentsFilePath(docUri: vscode.Uri): string {
        return docUri.fsPath + '.comments';
    }

    /**
     * Load comments from the sidecar file
     */
    static loadComments(docUri: vscode.Uri): Comment[] {
        const commentsPath = this.getCommentsFilePath(docUri);

        if (!existsSync(commentsPath)) {
            return [];
        }

        try {
            const content = readFileSync(commentsPath, 'utf8');
            const data: CommentFile = JSON.parse(content);
            return data.comments || [];
        } catch (error) {
            Output.debug(`Failed to load comments: ${error}`);
            return [];
        }
    }

    /**
     * Save comments to the sidecar file
     */
    static saveComments(docUri: vscode.Uri, comments: Comment[]): void {
        const commentsPath = this.getCommentsFilePath(docUri);

        const data: CommentFile = {
            version: "1.0",
            comments: comments
        };

        try {
            writeFileSync(commentsPath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            Output.debug(`Failed to save comments: ${error}`);
            vscode.window.showErrorMessage('Failed to save comments');
        }
    }

    /**
     * Generate a unique ID for a comment
     */
    static generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
    }

    /**
     * Add a new comment
     */
    static addComment(docUri: vscode.Uri, line: number, text: string, selectedText?: string): Comment[] {
        const comments = this.loadComments(docUri);

        const newComment: Comment = {
            id: this.generateId(),
            line,
            text,
            selectedText,
            timestamp: new Date().toISOString()
        };

        comments.push(newComment);
        this.saveComments(docUri, comments);

        return comments;
    }

    /**
     * Update an existing comment
     */
    static updateComment(docUri: vscode.Uri, commentId: string, newText: string): Comment[] {
        const comments = this.loadComments(docUri);

        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            comment.text = newText;
            comment.timestamp = new Date().toISOString();
            this.saveComments(docUri, comments);
        }

        return comments;
    }

    /**
     * Delete a comment
     */
    static deleteComment(docUri: vscode.Uri, commentId: string): Comment[] {
        let comments = this.loadComments(docUri);
        comments = comments.filter(c => c.id !== commentId);
        this.saveComments(docUri, comments);
        return comments;
    }

    /**
     * Update line numbers when document changes
     * Call this when lines are added/removed to keep comments aligned
     */
    static adjustLineNumbers(docUri: vscode.Uri, startLine: number, delta: number): void {
        const comments = this.loadComments(docUri);
        let changed = false;

        for (const comment of comments) {
            if (comment.line >= startLine) {
                comment.line += delta;
                changed = true;
            }
        }

        if (changed) {
            this.saveComments(docUri, comments);
        }
    }
}
