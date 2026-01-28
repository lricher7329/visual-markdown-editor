import * as vscode from 'vscode';
import { MarkdownEditorProvider } from './provider/markdownEditorProvider';
import { MarkdownService } from './service/markdownService';
import { ZoteroService } from './service/zotero/zoteroService';
import { detectZoteroPaths, describeDetectionResult } from './service/zotero/zoteroDetect';
import { zoteroLogger } from './service/zotero/zoteroLogger';

export function activate(context: vscode.ExtensionContext) {
	const viewOption = { webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true } };
	const markdownService = new MarkdownService(context);
	const markdownEditorProvider = new MarkdownEditorProvider(context);

	// Set extension path for ZoteroService
	ZoteroService.setExtensionPath(context.extensionPath);

	// Initialize Zotero logger with status bar
	zoteroLogger.initialize(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('document-viewer.markdown.switch', (uri) => { markdownService.switchEditor(uri); }),
		vscode.commands.registerCommand('document-viewer.markdown.paste', () => { markdownService.loadClipboardImage(); }),
		vscode.commands.registerCommand('document-viewer.cycleCountMode', () => { markdownEditorProvider.cycleCountMode(); }),
		vscode.commands.registerCommand('document-viewer.openInTypora', (uri) => { markdownService.openInTypora(uri); }),
		vscode.commands.registerCommand('document-viewer.zotero.detect', async () => {
			const result = await detectZoteroPaths();
			const message = describeDetectionResult(result);

			if (result.source === 'not_found') {
				vscode.window.showErrorMessage(message);
			} else {
				const action = await vscode.window.showInformationMessage(
					message,
					'Open Settings',
					'OK'
				);
				if (action === 'Open Settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'document-viewer.zotero');
				}
			}
		}),
		vscode.commands.registerCommand('document-viewer.zotero.refresh', async () => {
			const config = vscode.workspace.getConfiguration('document-viewer');
			if (!config.get('zotero.enabled', true)) {
				vscode.window.showWarningMessage('Zotero integration is disabled.');
				return;
			}

			try {
				const service = await ZoteroService.getInstanceAsync();
				const success = await service.refresh();
				if (success) {
					const items = await service.getItems();
					vscode.window.showInformationMessage(`Zotero library refreshed: ${items.length} items loaded.`);
				} else {
					vscode.window.showErrorMessage('Failed to refresh Zotero library. Check the Zotero log for details.');
				}
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Zotero refresh failed: ${msg}`);
			}
		}),
		vscode.commands.registerCommand('document-viewer.zotero.showOutput', () => {
			zoteroLogger.showOutput();
		}),
		vscode.commands.registerCommand('document-viewer.zotero.insertCitation', async () => {
			await MarkdownEditorProvider.openCitationPicker();
		}),
		vscode.commands.registerCommand('document-viewer.export', async () => {
			await MarkdownEditorProvider.openExportOptions(context.extensionPath);
		}),
		vscode.window.registerCustomEditorProvider("document-viewer.markdownEditor", markdownEditorProvider, viewOption),
		vscode.window.registerCustomEditorProvider("document-viewer.markdownEditor.optional", markdownEditorProvider, viewOption),
		// Reset ZoteroService and update status bar when configuration changes
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('document-viewer.zotero')) {
				ZoteroService.resetInstance();
				zoteroLogger.refreshVisibility();
			}
		}),
	);
}

export function deactivate() { }
