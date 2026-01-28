import { adjustImgPath, getWorkspacePath } from '@/common/fileUtil';
import { readFileSync, writeFileSync } from 'fs';
import { basename, isAbsolute, parse, resolve, relative } from 'path';
import * as vscode from 'vscode';
import { Handler } from '../common/handler';
import { Util } from '../common/util';
import { MarkdownService } from '../service/markdownService';
import { exportWithPandoc, getOutputPath } from '../service/pandocService';
import { Global } from '@/common/global';
import { platform } from 'os';
import { CommentService } from '../service/commentService';
import { ZoteroService } from '../service/zotero/zoteroService';
import { ZoteroSearchService, SortOption } from '../service/zotero/zoteroSearchService';
import { formatAuthors, formatTypes, formatCitation } from '../service/zotero/zoteroHelpers';
import { ZoteroItem } from '../service/zotero/zoteroTypes';
import { ConfigKeys, EditorThemes, SAVE_DEBOUNCE_MS } from '../types/config';
import { ExportOption } from '../types/messages';

/** Available count display modes for the status bar */
type CountMode = 'characters' | 'words' | 'lines' | 'pages';
const COUNT_MODES: CountMode[] = ['characters', 'words', 'lines', 'pages'];

/**
 * Custom text editor provider for markdown files.
 * Provides WYSIWYG editing using Vditor.
 */
export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {

    private extensionPath: string;
    private countStatus: vscode.StatusBarItem;
    private state: vscode.Memento;
    private currentCountMode: CountMode = 'characters';
    private currentContent: string = '';

    /**
     * Track the currently active document for clipboard operations.
     * This replaces the global Holder singleton.
     */
    private static _activeDocument: vscode.TextDocument | null = null;
    private static _activeHandler: Handler | null = null;

    public static get activeDocument(): vscode.TextDocument | null {
        return this._activeDocument;
    }

    public static get activeHandler(): Handler | null {
        return this._activeHandler;
    }

    /**
     * Open the Zotero citation picker. Can be called from event handler or command.
     */
    public static async openCitationPicker(handler?: Handler): Promise<void> {
        const activeHandler = handler || this._activeHandler;
        if (!activeHandler) {
            vscode.window.showWarningMessage('No active markdown editor. Open a markdown file first.');
            return;
        }

        const config = Global.getConfiguration();
        if (!config.get('zotero.enabled', true)) {
            vscode.window.showWarningMessage('Zotero integration is disabled. Enable it in settings.');
            return;
        }

        try {
            const zoteroService = await ZoteroService.getInstanceAsync();
            const connected = await zoteroService.connectIfNeeded();
            if (!connected) {
                return;
            }

            const items = await zoteroService.getItems();
            if (items.length === 0) {
                vscode.window.showInformationMessage('No items found in Zotero library. Make sure Zotero is installed with Better BibTeX.');
                return;
            }

            // Initialize search service with items
            const searchService = new ZoteroSearchService();
            searchService.updateIndex(items);

            // Create custom QuickPick for multi-select and preview
            const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { item: ZoteroItem }>();
            quickPick.placeholder = 'Search Zotero — combine filters: author:Smith year:2024 keyword';
            quickPick.canSelectMany = true;
            quickPick.matchOnDescription = true;
            quickPick.matchOnDetail = true;

            // Sort options button
            const sortOptions: SortOption[] = ['relevance', 'dateAdded', 'dateModified', 'year', 'title', 'author'];
            let currentSort: SortOption = 'relevance';

            const formatItem = (item: ZoteroItem) => ({
                label: `${formatTypes(item.itemType)} ${formatAuthors(item.creators)} (${item.year || 'n.d.'})`,
                description: `@${item.citeKey}`,
                detail: item.title + (item.publicationTitle ? ` — ${item.publicationTitle}` : ''),
                alwaysShow: true,
                item
            });

            const updateItems = (query: string) => {
                if (query.trim()) {
                    const results = searchService.search(query, currentSort, 100);
                    quickPick.items = results.map(r => formatItem(r.item));
                } else {
                    const results = searchService.search('', currentSort, 100);
                    quickPick.items = results.map(r => formatItem(r.item));
                }
            };

            updateItems('');

            quickPick.onDidChangeValue(value => {
                updateItems(value);
            });

            quickPick.buttons = [
                {
                    iconPath: new vscode.ThemeIcon('list-ordered'),
                    tooltip: `Sort by: ${currentSort} (click to change)`
                },
                {
                    iconPath: new vscode.ThemeIcon('question'),
                    tooltip: 'Search help'
                }
            ];

            quickPick.onDidTriggerButton(async button => {
                if (button.tooltip?.startsWith('Sort by:')) {
                    const currentIndex = sortOptions.indexOf(currentSort);
                    currentSort = sortOptions[(currentIndex + 1) % sortOptions.length];
                    quickPick.buttons = [
                        {
                            iconPath: new vscode.ThemeIcon('list-ordered'),
                            tooltip: `Sort by: ${currentSort} (click to change)`
                        },
                        quickPick.buttons[1]
                    ];
                    updateItems(quickPick.value);
                } else if (button.tooltip === 'Search help') {
                    vscode.window.showInformationMessage(
                        'Filters: author: year: tag: journal: collection: type: — ' +
                        'Combine with spaces: author:Smith year:2024 keyword. ' +
                        'Quotes for multi-word: author:"John Smith"'
                    );
                }
            });

            quickPick.onDidChangeActive(activeItems => {
                if (activeItems.length === 1) {
                    const item = (activeItems[0] as { item: ZoteroItem }).item;
                    if (item.abstract) {
                        const truncatedAbstract = item.abstract.length > 200
                            ? item.abstract.substring(0, 200) + '...'
                            : item.abstract;
                        quickPick.title = truncatedAbstract;
                    } else {
                        quickPick.title = undefined;
                    }
                } else {
                    quickPick.title = undefined;
                }
            });

            quickPick.onDidAccept(() => {
                const selectedItems = quickPick.selectedItems.length > 0
                    ? quickPick.selectedItems
                    : quickPick.activeItems;

                if (selectedItems.length > 0) {
                    const citeKeys = selectedItems.map(s => (s as { item: ZoteroItem }).item.citeKey);
                    citeKeys.forEach(key => searchService.recordUsage(key));

                    const citationText = citeKeys.length === 1
                        ? formatCitation(citeKeys[0])
                        : citeKeys.map(key => formatCitation(key)).join('; ');

                    activeHandler.emit("insertMarkdown", citationText);
                }
                quickPick.hide();
            });

            quickPick.onDidHide(() => quickPick.dispose());
            quickPick.show();

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Zotero error: ${message}`);
        }
    }

    /**
     * Open the export options picker. Can be called from event handler or command.
     */
    public static async openExportOptions(extensionPath: string): Promise<void> {
        const document = this._activeDocument;
        if (!document) {
            vscode.window.showWarningMessage('No active markdown editor. Open a markdown file first.');
            return;
        }

        const uri = document.uri;

        // Step 1: Choose export format
        const formatItems: vscode.QuickPickItem[] = [
            { label: 'PDF (with Citations)', description: 'Export to PDF using Pandoc with bibliography' },
            { label: 'DOCX (with Citations)', description: 'Export to Word using Pandoc with bibliography' },
            { label: 'PDF', description: 'Export to PDF (no citation processing)' },
            { label: 'DOCX', description: 'Export to Word (no citation processing)' },
            { label: 'HTML', description: 'Export to HTML' }
        ];

        const formatChoice = await vscode.window.showQuickPick(formatItems, {
            placeHolder: 'Select export format'
        });
        if (!formatChoice) return;

        // Map selection to export type
        type ExportType = 'pdf' | 'html' | 'docx' | 'pdf-pandoc' | 'docx-pandoc';
        const formatMap: Record<string, ExportType> = {
            'PDF (with Citations)': 'pdf-pandoc',
            'DOCX (with Citations)': 'docx-pandoc',
            'PDF': 'pdf',
            'DOCX': 'docx',
            'HTML': 'html'
        };
        const exportType = formatMap[formatChoice.label];

        // For Pandoc exports, show citation style picker
        let cslStyle: string | undefined;
        let referenceDoc: string | undefined;

        if (exportType === 'pdf-pandoc' || exportType === 'docx-pandoc') {
            // Step 2: Choose citation style
            const config = vscode.workspace.getConfiguration('document-viewer');
            const currentStyle = config.get<string>('pandoc.cslStyle', 'apa');

            const styleItems: vscode.QuickPickItem[] = [
                { label: 'apa', description: 'APA 7th Edition' + (currentStyle === 'apa' ? ' (current default)' : '') },
                { label: 'chicago-author-date', description: 'Chicago Author-Date' + (currentStyle === 'chicago-author-date' ? ' (current default)' : '') },
                { label: 'vancouver', description: 'Vancouver (medicine, nursing)' + (currentStyle === 'vancouver' ? ' (current default)' : '') },
                { label: 'ieee', description: 'IEEE (engineering, CS)' + (currentStyle === 'ieee' ? ' (current default)' : '') },
                { label: 'nature', description: 'Nature (natural sciences)' + (currentStyle === 'nature' ? ' (current default)' : '') },
                { label: 'mla', description: 'MLA (literature, arts)' + (currentStyle === 'mla' ? ' (current default)' : '') },
                { label: '$(file) Custom CSL file...', description: 'Browse for a .csl file' }
            ];

            const styleChoice = await vscode.window.showQuickPick(styleItems, {
                placeHolder: 'Select citation style'
            });
            if (!styleChoice) return;

            if (styleChoice.label.includes('Custom CSL file')) {
                const cslFiles = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: { 'CSL Style': ['csl'] },
                    title: 'Select Citation Style File'
                });
                if (!cslFiles || cslFiles.length === 0) return;
                cslStyle = cslFiles[0].fsPath;
            } else {
                cslStyle = styleChoice.label;
            }

            // Step 3: For DOCX, optionally choose template
            if (exportType === 'docx-pandoc') {
                const templateItems: vscode.QuickPickItem[] = [
                    { label: 'Use default template', description: 'Pandoc\'s built-in DOCX template' },
                    { label: '$(file) Choose custom template...', description: 'Browse for a .docx template' }
                ];

                const currentTemplate = config.get<string>('pandoc.referenceDoc', '');
                if (currentTemplate) {
                    templateItems.splice(1, 0, {
                        label: '$(check) Use configured template',
                        description: currentTemplate
                    });
                }

                const templateChoice = await vscode.window.showQuickPick(templateItems, {
                    placeHolder: 'Select DOCX template (optional)'
                });
                if (!templateChoice) return;

                if (templateChoice.label.includes('Choose custom template')) {
                    const docxFiles = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: { 'Word Template': ['docx'] },
                        title: 'Select DOCX Template'
                    });
                    if (!docxFiles || docxFiles.length === 0) {
                        return;
                    }
                    referenceDoc = docxFiles[0].fsPath;
                } else if (templateChoice.label.includes('Use configured template')) {
                    referenceDoc = currentTemplate;
                }
            }
        }

        // Execute export
        vscode.commands.executeCommand('workbench.action.files.save');

        if (exportType === 'pdf-pandoc' || exportType === 'docx-pandoc') {
            const format = exportType === 'pdf-pandoc' ? 'pdf' : 'docx';
            const outputPath = getOutputPath(uri.fsPath, format);
            await exportWithPandoc({
                inputPath: uri.fsPath,
                outputPath,
                outputFormat: format,
                cslStyle,
                referenceDoc
            }, extensionPath);
        } else {
            // For non-Pandoc exports, we need access to the context
            // This is a limitation - we'll show a message for now
            const markdownService = new MarkdownService(vscode.extensions.getExtension('md-editor.md-editor')?.extensionUri
                ? { extensionPath, extensionUri: vscode.Uri.file(extensionPath) } as vscode.ExtensionContext
                : undefined as any);
            markdownService.exportMarkdown(uri, { type: exportType });
        }
    }

    constructor(private context: vscode.ExtensionContext) {
        this.extensionPath = context.extensionPath;
        this.countStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.countStatus.command = 'document-viewer.cycleCountMode';
        this.countStatus.tooltip = 'Click to cycle: Characters → Words → Lines → Pages';
        this.state = context.globalState;

        // Set extension path for Zotero service to locate WASM file
        ZoteroService.setExtensionPath(context.extensionPath);
    }

    /** Cycle to the next count display mode */
    public cycleCountMode(): void {
        const currentIndex = COUNT_MODES.indexOf(this.currentCountMode);
        this.currentCountMode = COUNT_MODES[(currentIndex + 1) % COUNT_MODES.length];
        this.updateCount(this.currentContent);
    }

    private getFolders(): vscode.Uri[] {
        const data: vscode.Uri[] = [];
        for (let i = 65; i <= 90; i++) {
            data.push(vscode.Uri.file(`${String.fromCharCode(i)}:/`));
        }
        return data;
    }

    resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): void | Thenable<void> {
        const uri = document.uri;
        const webview = webviewPanel.webview;
        const folderPath = vscode.Uri.joinPath(uri, '..');
        webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file("/"), ...this.getFolders()]
        };
        const handler = Handler.bind(webviewPanel, uri);
        this.handleMarkdown(document, handler, folderPath);
        handler.on('developerTool', () => vscode.commands.executeCommand('workbench.action.toggleDevTools'));
    }

    private handleMarkdown(document: vscode.TextDocument, handler: Handler, folderPath: vscode.Uri): void {
        const uri = document.uri;
        const webview = handler.panel.webview;

        let content = document.getText();
        const contextPath = `${this.extensionPath}/resource/vditor`;
        const rootPath = webview.asWebviewUri(vscode.Uri.file(`${contextPath}`)).toString();

        // Track active document and handler for this editor
        MarkdownEditorProvider._activeDocument = document;
        MarkdownEditorProvider._activeHandler = handler;

        handler.panel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible) {
                MarkdownEditorProvider._activeDocument = document;
                MarkdownEditorProvider._activeHandler = handler;
                this.updateCount(content);
                this.countStatus.show();
            } else {
                this.countStatus.hide();
            }
        });

        // Clean up on dispose
        handler.panel.onDidDispose(() => {
            if (MarkdownEditorProvider._activeDocument === document) {
                MarkdownEditorProvider._activeDocument = null;
            }
            this.countStatus.hide();
            handler.emit("dispose");
        });

        let lastManualSaveTime = 0;
        const config = Global.getConfiguration();

        handler.on("init", () => {
            const scrollTop = this.state.get<number>(`scrollTop_${document.uri.fsPath}`, 0);
            handler.emit("open", {
                title: basename(uri.fsPath),
                config,
                scrollTop,
                rootPath,
                content
            });
            this.updateCount(content);
            this.countStatus.show();
        }).on("externalUpdate", e => {
            if (lastManualSaveTime && Date.now() - lastManualSaveTime < SAVE_DEBOUNCE_MS) return;
            const updatedText = e.document.getText()?.replace(/\r/g, '');
            if (content === updatedText) return;
            content = updatedText;
            this.updateCount(content);
            handler.emit("update", updatedText);
        }).on("command", (command) => {
            vscode.commands.executeCommand(command);
        }).on("openLink", (uriString) => {
            const resReg = /https:\/\/file.*\.net/i;
            if (uriString.match(resReg)) {
                const localPath = uriString.replace(resReg, '');
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(localPath));
            } else {
                vscode.env.openExternal(vscode.Uri.parse(uriString));
            }
        }).on("scroll", ({ scrollTop }) => {
            this.state.update(`scrollTop_${document.uri.fsPath}`, scrollTop);
        }).on("img", async (img) => {
            const { relPath, fullPath } = adjustImgPath(uri);
            const imagePath = isAbsolute(fullPath) ? fullPath : `${resolve(uri.fsPath, "..")}/${relPath}`.replace(/\\/g, "/");
            writeFileSync(imagePath, Buffer.from(img, 'binary'));
            const fileName = parse(relPath).name;
            const adjustRelPath = await MarkdownService.imgExtGuide(imagePath, relPath);
            vscode.env.clipboard.writeText(`![${fileName}](${adjustRelPath})`);
            vscode.commands.executeCommand("editor.action.clipboardPasteAction");
        }).on("quickOpen", () => {
            vscode.commands.executeCommand('workbench.action.quickOpen');
        }).on("insertImage", async () => {
            const result = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
                },
                title: 'Select Image'
            });
            if (result && result[0]) {
                const imagePath = result[0].fsPath;
                const docDir = resolve(uri.fsPath, "..");
                // Calculate relative path from document to image
                const relativePath = relative(docDir, imagePath).replace(/\\/g, "/");
                const fileName = parse(imagePath).name;
                // Insert markdown image syntax
                handler.emit("insertMarkdown", `![${fileName}](${relativePath})`);
            }
        }).on("editInVSCode", (full) => {
            const side = full ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside;
            vscode.commands.executeCommand('vscode.openWith', uri, "default", side);
        }).on("save", (newContent) => {
            if (lastManualSaveTime && Date.now() - lastManualSaveTime < SAVE_DEBOUNCE_MS) return;
            content = newContent;
            this.updateTextDocument(document, newContent);
            this.updateCount(content);
        }).on("doSave", async (newContent) => {
            lastManualSaveTime = Date.now();
            await this.updateTextDocument(document, newContent);
            this.updateCount(newContent);
            vscode.commands.executeCommand('workbench.action.files.save');
        }).on("export", async (option: ExportOption) => {
            vscode.commands.executeCommand('workbench.action.files.save');

            // Route Pandoc export types to PandocService
            if (option.type === 'pdf-pandoc' || option.type === 'docx-pandoc') {
                const format = option.type === 'pdf-pandoc' ? 'pdf' : 'docx';
                const outputPath = getOutputPath(uri.fsPath, format);
                await exportWithPandoc({
                    inputPath: uri.fsPath,
                    outputPath,
                    outputFormat: format,
                    cslStyle: option.cslStyle,
                    referenceDoc: option.referenceDoc
                }, this.extensionPath);
            } else {
                new MarkdownService(this.context).exportMarkdown(uri, option);
            }
        }).on("openExportOptions", async () => {
            // Step 1: Choose export format
            const formatItems: vscode.QuickPickItem[] = [
                { label: 'PDF (with Citations)', description: 'Export to PDF using Pandoc with bibliography' },
                { label: 'DOCX (with Citations)', description: 'Export to Word using Pandoc with bibliography' },
                { label: 'PDF', description: 'Export to PDF (no citation processing)' },
                { label: 'DOCX', description: 'Export to Word (no citation processing)' },
                { label: 'HTML', description: 'Export to HTML' }
            ];

            const formatChoice = await vscode.window.showQuickPick(formatItems, {
                placeHolder: 'Select export format'
            });
            if (!formatChoice) return;

            // Map selection to export type
            const formatMap: Record<string, ExportOption['type']> = {
                'PDF (with Citations)': 'pdf-pandoc',
                'DOCX (with Citations)': 'docx-pandoc',
                'PDF': 'pdf',
                'DOCX': 'docx',
                'HTML': 'html'
            };
            const exportType = formatMap[formatChoice.label];

            // For Pandoc exports, show citation style picker
            let cslStyle: string | undefined;
            let referenceDoc: string | undefined;

            if (exportType === 'pdf-pandoc' || exportType === 'docx-pandoc') {
                // Step 2: Choose citation style
                const config = vscode.workspace.getConfiguration('document-viewer');
                const currentStyle = config.get<string>('pandoc.cslStyle', 'apa');

                const styleItems: vscode.QuickPickItem[] = [
                    { label: 'apa', description: 'APA 7th Edition' + (currentStyle === 'apa' ? ' (current default)' : '') },
                    { label: 'chicago-author-date', description: 'Chicago Author-Date' + (currentStyle === 'chicago-author-date' ? ' (current default)' : '') },
                    { label: 'vancouver', description: 'Vancouver (medicine, nursing)' + (currentStyle === 'vancouver' ? ' (current default)' : '') },
                    { label: 'ieee', description: 'IEEE (engineering, CS)' + (currentStyle === 'ieee' ? ' (current default)' : '') },
                    { label: 'nature', description: 'Nature (natural sciences)' + (currentStyle === 'nature' ? ' (current default)' : '') },
                    { label: 'mla', description: 'MLA (literature, arts)' + (currentStyle === 'mla' ? ' (current default)' : '') },
                    { label: '$(file) Custom CSL file...', description: 'Browse for a .csl file' }
                ];

                const styleChoice = await vscode.window.showQuickPick(styleItems, {
                    placeHolder: 'Select citation style'
                });
                if (!styleChoice) return;

                if (styleChoice.label.includes('Custom CSL file')) {
                    const cslFiles = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: { 'CSL Style': ['csl'] },
                        title: 'Select Citation Style File'
                    });
                    if (!cslFiles || cslFiles.length === 0) return;
                    cslStyle = cslFiles[0].fsPath;
                } else {
                    cslStyle = styleChoice.label;
                }

                // Step 3: For DOCX, optionally choose template
                if (exportType === 'docx-pandoc') {
                    const templateItems: vscode.QuickPickItem[] = [
                        { label: 'Use default template', description: 'Pandoc\'s built-in DOCX template' },
                        { label: '$(file) Choose custom template...', description: 'Browse for a .docx template' }
                    ];

                    const currentTemplate = config.get<string>('pandoc.referenceDoc', '');
                    if (currentTemplate) {
                        templateItems.splice(1, 0, {
                            label: '$(check) Use configured template',
                            description: currentTemplate
                        });
                    }

                    const templateChoice = await vscode.window.showQuickPick(templateItems, {
                        placeHolder: 'Select DOCX template (optional)'
                    });
                    if (!templateChoice) return;

                    if (templateChoice.label.includes('Choose custom template')) {
                        const docxFiles = await vscode.window.showOpenDialog({
                            canSelectFiles: true,
                            canSelectFolders: false,
                            canSelectMany: false,
                            filters: { 'Word Template': ['docx'] },
                            title: 'Select DOCX Template'
                        });
                        if (!docxFiles || docxFiles.length === 0) {
                            // User cancelled the file dialog
                            return;
                        }
                        referenceDoc = docxFiles[0].fsPath;
                    } else if (templateChoice.label.includes('Use configured template')) {
                        referenceDoc = currentTemplate;
                    }
                }
            }

            // Execute export
            vscode.commands.executeCommand('workbench.action.files.save');

            if (exportType === 'pdf-pandoc' || exportType === 'docx-pandoc') {
                const format = exportType === 'pdf-pandoc' ? 'pdf' : 'docx';
                const outputPath = getOutputPath(uri.fsPath, format);
                await exportWithPandoc({
                    inputPath: uri.fsPath,
                    outputPath,
                    outputFormat: format,
                    cslStyle,
                    referenceDoc
                }, this.extensionPath);
            } else {
                new MarkdownService(this.context).exportMarkdown(uri, { type: exportType });
            }
        }).on("theme", async (theme) => {
            if (!theme) {
                const currentTheme = Global.getConfig<string>(ConfigKeys.editorTheme);
                const themeItems: vscode.QuickPickItem[] = [];

                for (const t of EditorThemes) {
                    if (t === "Light") {
                        themeItems.push({ label: '|', kind: vscode.QuickPickItemKind.Separator });
                    } else if (t === "One Dark") {
                        themeItems.push({ label: '|', kind: vscode.QuickPickItemKind.Separator });
                    }
                    themeItems.push({
                        label: t,
                        description: t === currentTheme ? 'Current' : undefined
                    });
                }

                const selected = await vscode.window.showQuickPick(themeItems, {
                    placeHolder: "Select Editor Theme"
                });
                if (!selected) return;
                theme = selected;
            }
            handler.emit('theme', theme.label);
            Global.updateConfig(ConfigKeys.editorTheme, theme.label);
        }).on("saveOutline", (enable) => {
            Global.updateConfig(ConfigKeys.openOutline, enable);
        }).on('developerTool', () => {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
        }).on("loadComments", () => {
            const comments = CommentService.loadComments(uri);
            handler.emit("commentsLoaded", comments);
        }).on("addComment", ({ line, text, selectedText }) => {
            const comments = CommentService.addComment(uri, line, text, selectedText);
            handler.emit("commentsLoaded", comments);
        }).on("updateComment", ({ id, text }) => {
            const comments = CommentService.updateComment(uri, id, text);
            handler.emit("commentsLoaded", comments);
        }).on("deleteComment", ({ id }) => {
            const comments = CommentService.deleteComment(uri, id);
            handler.emit("commentsLoaded", comments);
        }).on("openInTypora", () => {
            vscode.commands.executeCommand('document-viewer.openInTypora', uri);
        }).on("openCitationPicker", async () => {
            await MarkdownEditorProvider.openCitationPicker(handler);
        });

        const basePath = Global.getConfig<boolean>(ConfigKeys.workspacePathAsImageBasePath)
            ? vscode.Uri.file(getWorkspacePath(folderPath))
            : folderPath;
        const baseUrl = webview.asWebviewUri(basePath).toString().replace(/\?.+$/, '').replace('https://git', 'https://file');

        webview.html = Util.buildPath(
            readFileSync(`${this.extensionPath}/resource/vditor/index.html`, 'utf8')
                .replace("{{rootPath}}", rootPath)
                .replace("{{baseUrl}}", baseUrl)
                .replace(`{{configs}}`, JSON.stringify({
                    platform: platform()
                })),
            webview, contextPath);
    }

    private updateCount(content: string): void {
        this.currentContent = content;

        switch (this.currentCountMode) {
            case 'characters': {
                const chars = content.length;
                this.countStatus.text = `$(text-size) ${chars.toLocaleString()} chars`;
                break;
            }
            case 'words': {
                const words = content.trim() ? content.trim().split(/\s+/).length : 0;
                this.countStatus.text = `$(word-wrap) ${words.toLocaleString()} words`;
                break;
            }
            case 'lines': {
                const lines = content.split(/\r\n|\r|\n/).length;
                this.countStatus.text = `$(list-ordered) ${lines.toLocaleString()} lines`;
                break;
            }
            case 'pages': {
                // Estimate ~250 words per printed page (standard manuscript format)
                const words = content.trim() ? content.trim().split(/\s+/).length : 0;
                const pages = Math.ceil(words / 250) || 1;
                this.countStatus.text = `$(file) ~${pages} ${pages === 1 ? 'page' : 'pages'}`;
                break;
            }
        }
    }

    private updateTextDocument(document: vscode.TextDocument, content: string): Thenable<boolean> {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), content);
        return vscode.workspace.applyEdit(edit);
    }
}
