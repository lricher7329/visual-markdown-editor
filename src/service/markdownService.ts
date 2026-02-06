import { adjustImgPath } from "@/common/fileUtil";
import { Output } from "@/common/Output";
import { spawn } from 'child_process';
import chromeFinder from 'chrome-finder';
import { fileTypeFromFile } from 'file-type';
import { copyFileSync, existsSync, lstatSync, mkdirSync, renameSync } from 'fs';
import { homedir } from 'os';
import path, { dirname, extname, isAbsolute, join, parse } from 'path';
import * as vscode from 'vscode';
import { MarkdownEditorProvider } from '../provider/markdownEditorProvider';
import { convertMd } from "./markdown/markdown-pdf";
import { Global } from "@/common/global";
import { ConfigKeys } from "../types/config";
import { ExportOption } from "../types/messages";

/**
 * Service for markdown export and clipboard image handling.
 */
export class MarkdownService {

    constructor(private context: vscode.ExtensionContext) {
    }

    /**
     * Export markdown to another format (pdf, html, docx)
     */
    public async exportMarkdown(uri: vscode.Uri, option: ExportOption = {}): Promise<void> {
        const { type = 'pdf' } = option;
        try {
            if (type !== 'html') {
                vscode.window.showInformationMessage(`Starting export markdown to ${type}.`);
            }
            await convertMd({ markdownFilePath: uri.fsPath, config: this.getConfig(option) });
            vscode.window.showInformationMessage(`Export markdown to ${type} success!`);
        } catch (error) {
            Output.log(error);
        }
    }

    public getConfig(option: ExportOption) {
        const top = Global.getConfig<number>(ConfigKeys.pdfMarginTop);
        const { type = 'pdf', withoutOutline = false } = option;
        return {
            type,
            "styles": [],
            withoutOutline,
            "executablePath": this.getChromiumPath(),
            "breaks": false,
            "printBackground": true,
            format: "A4",
            margin: { top }
        };
    }

    /**
     * Known Chromium browser paths for PDF export
     */
    private readonly browserPaths: string[] = [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge Beta\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge Dev\\Application\\msedge.exe",
        join(homedir(), "AppData\\Local\\Microsoft\\Edge SxS\\Application\\msedge.exe"),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        "/usr/bin/microsoft-edge",
    ];

    private getChromiumPath(): string {
        const chromiumPath = Global.getConfig<string>(ConfigKeys.chromiumPath);
        const paths = [chromiumPath, ...this.browserPaths].filter(Boolean);

        for (const browserPath of paths) {
            if (browserPath && existsSync(browserPath)) {
                Output.debug(`using chromium path is ${browserPath}`);
                return browserPath;
            }
        }

        try {
            const chromePath = chromeFinder();
            Output.debug(`using chrome path is ${chromePath}`);
            return chromePath;
        } catch {
            const msg = "No Chromium browser found, export failed.";
            vscode.window.showErrorMessage(msg);
            throw new Error(msg);
        }
    }

    /**
     * Handle clipboard image paste operation
     */
    public async loadClipboardImage(): Promise<void> {
        // Get document from active editor or from the markdown editor provider
        const document = vscode.window.activeTextEditor?.document || MarkdownEditorProvider.activeDocument;

        if (await vscode.env.clipboard.readText()) {
            vscode.commands.executeCommand("editor.action.clipboardPasteAction");
            return;
        }

        if (!document || document.isUntitled || document.isClosed) {
            return;
        }

        const uri = document.uri;
        const info = adjustImgPath(uri);
        const { fullPath } = info;
        let { relPath } = info;
        const imagePath = isAbsolute(fullPath) ? fullPath : `${dirname(uri.fsPath)}/${relPath}`.replace(/\\/g, "/");

        this.createImgDir(imagePath);
        this.saveClipboardImageToFileAndGetPath(imagePath, async (savedImagePath) => {
            if (!savedImagePath) return;
            if (savedImagePath === 'no image') {
                vscode.window.showErrorMessage('There is not an image in the clipboard.');
                return;
            }
            this.copyFromPath(savedImagePath, imagePath);
            const editor = vscode.window.activeTextEditor;
            const imgName = parse(relPath).name;
            relPath = await MarkdownService.imgExtGuide(imagePath, relPath);
            if (editor) {
                editor.edit(edit => {
                    const current = editor.selection;
                    if (current.isEmpty) {
                        edit.insert(current.start, `![${imgName}](${relPath})`);
                    } else {
                        edit.replace(current, `![${imgName}](${relPath})`);
                    }
                });
            } else {
                vscode.env.clipboard.writeText(`![${imgName}](${relPath})`);
                vscode.commands.executeCommand("editor.action.clipboardPasteAction");
            }
        });
    }

    /**
     * Detect actual image type and rename file if extension doesn't match
     */
    public static async imgExtGuide(absPath: string, relPath: string): Promise<string> {
        const oldExt = extname(absPath);
        const { ext = "png" } = (await fileTypeFromFile(absPath)) ?? {};
        if (oldExt !== `.${ext}`) {
            relPath = relPath.replace(oldExt, `.${ext}`);
            renameSync(absPath, absPath.replace(oldExt, `.${ext}`));
        }
        return relPath;
    }

    /**
     * If clipboard contains a file path, copy the file to target location
     */
    private copyFromPath(savedImagePath: string, targetPath: string): void {
        if (savedImagePath.startsWith("copied:")) {
            const copiedFile = savedImagePath.replace("copied:", "");
            if (lstatSync(copiedFile).isDirectory()) {
                vscode.window.showErrorMessage('Not support paste directory.');
            } else {
                copyFileSync(copiedFile, targetPath);
            }
        }
    }

    private createImgDir(imagePath: string): void {
        const dir = path.dirname(imagePath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    private saveClipboardImageToFileAndGetPath(imagePath: string, cb: (value: string) => void): void {
        if (!imagePath) return;
        const platform = process.platform;

        if (platform === 'win32') {
            const scriptPath = path.join(this.context.extensionPath, '/lib/pc.ps1');
            const powershell = spawn('powershell', [
                '-noprofile',
                '-noninteractive',
                '-nologo',
                '-sta',
                '-executionpolicy', 'unrestricted',
                '-windowstyle', 'hidden',
                '-file', scriptPath,
                imagePath
            ]);
            powershell.stdout.on('data', function (data) {
                cb(data.toString().trim());
            });
        } else if (platform === 'darwin') {
            const scriptPath = path.join(this.context.extensionPath, './lib/mac.applescript');
            const ascript = spawn('osascript', [scriptPath, imagePath]);
            ascript.stdout.on('data', function (data) {
                cb(data.toString().trim());
            });
        } else {
            const scriptPath = path.join(this.context.extensionPath, './lib/linux.sh');
            const ascript = spawn('sh', [scriptPath, imagePath]);
            ascript.stdout.on('data', function (data) {
                const result = data.toString().trim();
                if (result === "no xclip") {
                    vscode.window.showInformationMessage('You need to install xclip command first.');
                    return;
                }
                cb(result);
            });
        }
    }

    public switchEditor(uri: vscode.Uri): void {
        const editor = vscode.window.activeTextEditor;
        if (!uri) {
            uri = editor?.document.uri as vscode.Uri;
        }
        const type = editor ? 'cweijan.markdownViewer' : 'default';
        vscode.commands.executeCommand('vscode.openWith', uri, type);
    }

    /**
     * Open a markdown file in Typora
     * @param uri Optional URI - uses active editor if not provided
     */
    public openInTypora(uri?: vscode.Uri): void {
        // Get URI from parameter, active editor, or markdown editor provider
        if (!uri) {
            uri = vscode.window.activeTextEditor?.document.uri;
        }
        if (!uri) {
            const activeDoc = MarkdownEditorProvider.activeDocument;
            if (activeDoc) {
                uri = activeDoc.uri;
            }
        }

        if (!uri) {
            vscode.window.showErrorMessage('No active markdown file to open.');
            return;
        }

        const filePath = uri.fsPath;
        const ext = path.extname(filePath).toLowerCase();
        if (ext !== '.md' && ext !== '.markdown' && ext !== '.qmd') {
            vscode.window.showErrorMessage('The file is not a markdown file.');
            return;
        }

        const platform = process.platform;
        let command: string;

        if (platform === 'darwin') {
            // macOS: use 'open -a' to launch Typora
            command = `open -a "Typora" "${filePath}"`;
        } else if (platform === 'win32') {
            // Windows: use start command with Typora
            command = `start "" "Typora" "${filePath}"`;
        } else {
            // Linux: assume typora is in PATH
            command = `typora "${filePath}"`;
        }

        // Use hidden terminal for reliable cross-platform execution
        const terminal = vscode.window.createTerminal({
            name: 'Typora',
            hideFromUser: true
        });
        terminal.sendText(command);

        // Dispose terminal after a short delay
        setTimeout(() => terminal.dispose(), 2000);
    }
}
