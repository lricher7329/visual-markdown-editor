import * as vscode from 'vscode';
import { Comment } from '../service/commentService';

/**
 * Export types supported by the markdown exporter
 */
export type ExportType = 'pdf' | 'html' | 'docx' | 'pdf-pandoc' | 'docx-pandoc';

/**
 * Export options for markdown conversion
 */
export interface ExportOption {
    type?: ExportType;
    withoutOutline?: boolean;
    /** CSL style for Pandoc citation formatting */
    cslStyle?: string;
    /** Path to custom DOCX template for Pandoc export */
    referenceDoc?: string;
}

/**
 * Configuration passed to the webview on initialization
 */
export interface EditorConfig {
    openOutline?: boolean;
    hideToolbar?: boolean;
    previewCode?: boolean;
    preventMacOptionKey?: boolean;
    editorTheme?: string;
    editorLanguage?: string;
    previewCodeHighlight?: {
        style?: string;
        showLineNumber?: boolean;
    };
}

/**
 * Data sent when opening a document in the editor
 */
export interface OpenDocumentData {
    title: string;
    config: vscode.WorkspaceConfiguration;
    scrollTop: number;
    rootPath: string;
    content: string;
}

/**
 * Scroll position data
 */
export interface ScrollData {
    scrollTop: number;
}

/**
 * Comment operations
 */
export interface AddCommentData {
    line: number;
    text: string;
    selectedText?: string;
}

export interface UpdateCommentData {
    id: string;
    text: string;
}

export interface DeleteCommentData {
    id: string;
}

/**
 * Theme selection from quick pick
 */
export interface ThemeSelection {
    label: string;
}

// ============================================
// Messages FROM Webview TO Extension
// ============================================

export interface InitMessage {
    type: 'init';
}

export interface SaveMessage {
    type: 'save';
    content: string;
}

export interface DoSaveMessage {
    type: 'doSave';
    content: string;
}

export interface ExportMessage {
    type: 'export';
    content: ExportOption;
}

export interface ThemeMessage {
    type: 'theme';
    content: ThemeSelection | null;
}

export interface ScrollMessage {
    type: 'scroll';
    content: ScrollData;
}

export interface ImgMessage {
    type: 'img';
    content: string; // binary image data
}

export interface OpenLinkMessage {
    type: 'openLink';
    content: string; // URI
}

export interface EditInVSCodeMessage {
    type: 'editInVSCode';
    content: boolean; // full screen?
}

export interface CommandMessage {
    type: 'command';
    content: string; // command ID
}

export interface QuickOpenMessage {
    type: 'quickOpen';
}

export interface LoadCommentsMessage {
    type: 'loadComments';
}

export interface AddCommentMessage {
    type: 'addComment';
    content: AddCommentData;
}

export interface UpdateCommentMessage {
    type: 'updateComment';
    content: UpdateCommentData;
}

export interface DeleteCommentMessage {
    type: 'deleteComment';
    content: DeleteCommentData;
}

export interface SaveOutlineMessage {
    type: 'saveOutline';
    content: boolean;
}

export interface DeveloperToolMessage {
    type: 'developerTool';
}

export interface InsertImageMessage {
    type: 'insertImage';
}

export interface OpenInTyporaMessage {
    type: 'openInTypora';
}

export interface OpenCitationPickerMessage {
    type: 'openCitationPicker';
}

/**
 * Union type of all messages from webview to extension
 */
export type WebviewToExtensionMessage =
    | InitMessage
    | SaveMessage
    | DoSaveMessage
    | ExportMessage
    | ThemeMessage
    | ScrollMessage
    | ImgMessage
    | OpenLinkMessage
    | EditInVSCodeMessage
    | CommandMessage
    | QuickOpenMessage
    | LoadCommentsMessage
    | AddCommentMessage
    | UpdateCommentMessage
    | DeleteCommentMessage
    | SaveOutlineMessage
    | DeveloperToolMessage
    | InsertImageMessage
    | OpenInTyporaMessage
    | OpenCitationPickerMessage;

// ============================================
// Messages FROM Extension TO Webview
// ============================================

export interface OpenMessage {
    type: 'open';
    content: OpenDocumentData;
}

export interface UpdateMessage {
    type: 'update';
    content: string;
}

export interface ThemeChangeMessage {
    type: 'theme';
    content: string;
}

export interface CommentsLoadedMessage {
    type: 'commentsLoaded';
    content: Comment[];
}

export interface DisposeMessage {
    type: 'dispose';
}

export interface InsertMarkdownMessage {
    type: 'insertMarkdown';
    content: string;
}

/**
 * Union type of all messages from extension to webview
 */
export type ExtensionToWebviewMessage =
    | OpenMessage
    | UpdateMessage
    | ThemeChangeMessage
    | CommentsLoadedMessage
    | DisposeMessage
    | InsertMarkdownMessage;
