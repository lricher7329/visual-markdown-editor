import { EventEmitter } from "events";
import * as vscode from 'vscode';
import { WebviewPanel } from "vscode";
import { Output } from "./Output";
import {
    WebviewToExtensionMessage,
    ExtensionToWebviewMessage,
    ScrollData,
    ExportOption,
    AddCommentData,
    UpdateCommentData,
    DeleteCommentData,
    ThemeSelection
} from "../types/messages";

/**
 * Event handler callback types for each message type.
 * Using a more permissive callback type to accommodate Thenable returns from VS Code commands.
 */
interface EventHandlers {
    init: () => void | PromiseLike<void>;
    save: (content: string) => void | PromiseLike<void>;
    doSave: (content: string) => void | PromiseLike<void>;
    export: (option: ExportOption) => void | PromiseLike<void>;
    theme: (theme: ThemeSelection | null) => void | PromiseLike<void>;
    scroll: (data: ScrollData) => void | PromiseLike<void>;
    img: (imgData: string) => void | PromiseLike<void>;
    openLink: (uri: string) => void | PromiseLike<void>;
    editInVSCode: (fullScreen: boolean) => void | PromiseLike<void>;
    openInTypora: () => void | PromiseLike<void>;
    command: (commandId: string) => void | PromiseLike<void>;
    loadComments: () => void | PromiseLike<void>;
    addComment: (data: AddCommentData) => void | PromiseLike<void>;
    updateComment: (data: UpdateCommentData) => void | PromiseLike<void>;
    deleteComment: (data: DeleteCommentData) => void | PromiseLike<void>;
    saveOutline: (enable: boolean) => void | PromiseLike<void>;
    developerTool: () => void | PromiseLike<void>;
    quickOpen: () => void | PromiseLike<void>;
    insertImage: () => void | PromiseLike<void>;
    openCitationPicker: () => void | PromiseLike<void>;
    openExportOptions: () => void | PromiseLike<void>;
    // Internal events
    externalUpdate: (e: vscode.TextDocumentChangeEvent) => void | PromiseLike<void>;
    fileChange: (e: vscode.Uri) => void | PromiseLike<void>;
    dispose: () => void | PromiseLike<void>;
}

type EventName = keyof EventHandlers;

/**
 * Handler for bidirectional communication between VS Code extension and webview.
 * Provides type-safe event handling and message passing.
 */
export class Handler {

    constructor(public panel: WebviewPanel, private eventEmitter: EventEmitter) { }

    /**
     * Register an event handler for messages from the webview
     */
    on<E extends EventName>(event: E, callback: EventHandlers[E]): this {
        if (event !== 'init') {
            const listeners = this.eventEmitter.listeners(event);
            if (listeners.length >= 1) {
                this.eventEmitter.removeListener(event, listeners[0] as (...args: unknown[]) => void);
            }
        }
        this.eventEmitter.on(event, async (content: unknown) => {
            try {
                await (callback as (content: unknown) => void | Promise<void>)(content);
            } catch (error) {
                Output.debug(error);
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(error.message);
                }
            }
        });
        return this;
    }

    /**
     * Send a message to the webview
     */
    emit(type: ExtensionToWebviewMessage['type'], content?: unknown): this {
        this.panel.webview.postMessage({ type, content });
        return this;
    }

    /**
     * Bind a webview panel to create a new Handler with event listeners
     */
    public static bind(panel: WebviewPanel, uri: vscode.Uri): Handler {
        const eventEmitter = new EventEmitter();

        const fileWatcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);
        fileWatcher.onDidChange(e => {
            eventEmitter.emit("fileChange", e);
        });

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === uri.toString() && e.contentChanges.length > 0) {
                eventEmitter.emit("externalUpdate", e);
            }
        });

        panel.onDidDispose(() => {
            fileWatcher.dispose();
            changeDocumentSubscription.dispose();
            eventEmitter.emit("dispose");
        });

        // Forward messages from webview to event emitter
        panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
            eventEmitter.emit(message.type, 'content' in message ? message.content : undefined);
        });

        return new Handler(panel, eventEmitter);
    }
}
