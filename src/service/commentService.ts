import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';
import { Output } from '@/common/Output';

/** The commented text plus some context on each side (see resource/vditor/anchor.js) */
export interface CommentAnchor {
    exact: string;
    prefix: string;
    suffix: string;
}

export interface Comment {
    id: string;
    /** Legacy block index from when the comment was added; not used for placement */
    line: number;
    text: string;
    selectedText?: string;
    /** Where the comment attaches; absent in comments made before version 1.1 */
    anchor?: CommentAnchor;
    timestamp: string;
}

interface CommentFile {
    version: "1.0" | "1.1";
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
            version: "1.1",
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
    static addComment(docUri: vscode.Uri, line: number, text: string, selectedText?: string, anchor?: CommentAnchor): Comment[] {
        const comments = this.loadComments(docUri);

        const newComment: Comment = {
            id: this.generateId(),
            line,
            text,
            selectedText,
            anchor,
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
     * Attach a comment to new text, e.g. after its original text was edited away
     */
    static reattachComment(docUri: vscode.Uri, commentId: string, anchor: CommentAnchor, selectedText?: string): Comment[] {
        const comments = this.loadComments(docUri);

        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            comment.anchor = anchor;
            comment.selectedText = selectedText;
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
}
