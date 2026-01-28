/**
 * Logging and status management for Zotero integration
 */
import * as vscode from 'vscode';

export type ZoteroStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'warning';

export interface ZoteroStatusInfo {
    status: ZoteroStatus;
    message: string;
    itemCount?: number;
}

class ZoteroLogger {
    private static instance: ZoteroLogger | null = null;
    private outputChannel: vscode.OutputChannel | null = null;
    private statusBarItem: vscode.StatusBarItem | null = null;
    private currentStatus: ZoteroStatusInfo = { status: 'disconnected', message: 'Not connected' };

    private constructor() {}

    public static getInstance(): ZoteroLogger {
        if (!ZoteroLogger.instance) {
            ZoteroLogger.instance = new ZoteroLogger();
        }
        return ZoteroLogger.instance;
    }

    /**
     * Initialize the output channel and status bar
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.outputChannel = vscode.window.createOutputChannel('Markdown Editor - Zotero');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'document-viewer.zotero.showOutput';

        context.subscriptions.push(this.outputChannel);
        context.subscriptions.push(this.statusBarItem);

        this.updateStatusBar();
    }

    /**
     * Log an informational message
     */
    public info(message: string): void {
        this.log('INFO', message);
    }

    /**
     * Log a warning message
     */
    public warn(message: string): void {
        this.log('WARN', message);
    }

    /**
     * Log an error message
     */
    public error(message: string): void {
        this.log('ERROR', message);
    }

    /**
     * Log a debug message
     */
    public debug(message: string): void {
        this.log('DEBUG', message);
    }

    /**
     * Internal log method
     */
    private log(level: string, message: string): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] ${message}`;

        if (this.outputChannel) {
            this.outputChannel.appendLine(formattedMessage);
        }

        // Also log to console for development
        console.log(`[Zotero] ${formattedMessage}`);
    }

    /**
     * Update the Zotero status
     */
    public setStatus(info: ZoteroStatusInfo): void {
        this.currentStatus = info;
        this.updateStatusBar();
        this.info(`Status changed: ${info.status} - ${info.message}`);
    }

    /**
     * Get current status
     */
    public getStatus(): ZoteroStatusInfo {
        return this.currentStatus;
    }

    /**
     * Update the status bar item
     */
    private updateStatusBar(): void {
        if (!this.statusBarItem) {
            return;
        }

        const icons: Record<ZoteroStatus, string> = {
            disconnected: '$(circle-slash)',
            connecting: '$(sync~spin)',
            connected: '$(check)',
            error: '$(error)',
            warning: '$(warning)'
        };

        const colors: Record<ZoteroStatus, vscode.ThemeColor | undefined> = {
            disconnected: undefined,
            connecting: undefined,
            connected: new vscode.ThemeColor('statusBarItem.prominentForeground'),
            error: new vscode.ThemeColor('statusBarItem.errorForeground'),
            warning: new vscode.ThemeColor('statusBarItem.warningForeground')
        };

        const icon = icons[this.currentStatus.status];
        const itemCountText = this.currentStatus.itemCount !== undefined
            ? ` (${this.currentStatus.itemCount})`
            : '';

        this.statusBarItem.text = `${icon} Zotero${itemCountText}`;
        this.statusBarItem.tooltip = this.currentStatus.message;
        this.statusBarItem.color = colors[this.currentStatus.status];

        // Only show when Zotero is enabled
        const config = vscode.workspace.getConfiguration('document-viewer');
        if (config.get('zotero.enabled', true)) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    /**
     * Show the output channel
     */
    public showOutput(): void {
        if (this.outputChannel) {
            this.outputChannel.show();
        }
    }

    /**
     * Clear the output channel
     */
    public clear(): void {
        if (this.outputChannel) {
            this.outputChannel.clear();
        }
    }

    /**
     * Refresh status bar visibility based on settings
     */
    public refreshVisibility(): void {
        this.updateStatusBar();
    }
}

export const zoteroLogger = ZoteroLogger.getInstance();
