/**
 * Pandoc export service for citation-aware markdown conversion
 *
 * Exports markdown to PDF/DOCX with properly formatted citations
 * and bibliography using Pandoc's citeproc processor.
 */
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { generateBibFile, extractCitations } from './zotero/bibTexService';
import { Output } from '../common/Output';

const execAsync = promisify(exec);

/**
 * Result of Pandoc installation check
 */
export interface PandocStatus {
    installed: boolean;
    version?: string;
    path?: string;
    error?: string;
}

/**
 * Options for Pandoc export
 */
export interface PandocExportOptions {
    inputPath: string;
    outputPath: string;
    outputFormat: 'pdf' | 'docx';
    cslStyle?: string;
    /** Path to custom DOCX template (--reference-doc) */
    referenceDoc?: string;
    /** Additional Pandoc arguments */
    extraArgs?: string[];
}

/**
 * Result of Pandoc export
 */
export interface PandocExportResult {
    success: boolean;
    outputPath?: string;
    citationsFound: number;
    citationsMissing: string[];
    error?: string;
}

/**
 * Built-in CSL styles bundled with the extension
 */
const BUNDLED_STYLES: Record<string, string> = {
    'apa': 'apa.csl',
    'chicago': 'chicago-author-date.csl',
    'chicago-author-date': 'chicago-author-date.csl',
    'vancouver': 'vancouver.csl',
    'ieee': 'ieee.csl',
    'nature': 'nature.csl',
    'mla': 'modern-language-association.csl'
};

/**
 * Check if Pandoc is installed and get version info
 */
export async function checkPandocInstallation(): Promise<PandocStatus> {
    const config = vscode.workspace.getConfiguration('document-viewer');
    const customPath = config.get<string>('pandoc.path', '');

    const pandocCommand = customPath || 'pandoc';

    try {
        const { stdout } = await execAsync(`"${pandocCommand}" --version`);
        const versionMatch = stdout.match(/pandoc(?:\.exe)?\s+(\d+\.\d+(?:\.\d+)?)/i);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        // Get full path
        let pandocPath = customPath;
        if (!pandocPath) {
            try {
                const whichCmd = process.platform === 'win32' ? 'where' : 'which';
                const { stdout: pathResult } = await execAsync(`${whichCmd} pandoc`);
                pandocPath = pathResult.trim().split('\n')[0];
            } catch {
                pandocPath = 'pandoc';
            }
        }

        return {
            installed: true,
            version,
            path: pandocPath
        };
    } catch (error) {
        return {
            installed: false,
            error: 'Pandoc is not installed or not in PATH. Install from https://pandoc.org/installing.html'
        };
    }
}

/**
 * Get the path to a CSL style file
 */
export function getCslStylePath(
    styleName: string,
    extensionPath: string
): string | null {
    // Check if it's a bundled style
    const bundledFile = BUNDLED_STYLES[styleName.toLowerCase()];
    if (bundledFile) {
        const bundledPath = path.join(extensionPath, 'resource', 'csl', bundledFile);
        return bundledPath;
    }

    // Check if it's an absolute path to a CSL file
    if (path.isAbsolute(styleName) && styleName.endsWith('.csl')) {
        return styleName;
    }

    // Check if it's a relative path (relative to workspace)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const workspacePath = path.join(workspaceFolders[0].uri.fsPath, styleName);
        if (styleName.endsWith('.csl')) {
            return workspacePath;
        }
    }

    // Default to APA if style not found
    Output.log(`CSL style '${styleName}' not found, defaulting to APA`);
    return path.join(extensionPath, 'resource', 'csl', 'apa.csl');
}

/**
 * Export markdown to PDF or DOCX using Pandoc with citation processing
 */
export async function exportWithPandoc(
    options: PandocExportOptions,
    extensionPath: string
): Promise<PandocExportResult> {
    // Check Pandoc installation
    const pandocStatus = await checkPandocInstallation();
    if (!pandocStatus.installed) {
        vscode.window.showErrorMessage(
            pandocStatus.error || 'Pandoc not found',
            'Install Pandoc'
        ).then(selection => {
            if (selection === 'Install Pandoc') {
                vscode.env.openExternal(vscode.Uri.parse('https://pandoc.org/installing.html'));
            }
        });

        return {
            success: false,
            citationsFound: 0,
            citationsMissing: [],
            error: pandocStatus.error
        };
    }

    try {
        // Read markdown content
        const markdown = await fs.readFile(options.inputPath, 'utf8');

        // Check for citations
        const citeKeys = extractCitations(markdown);
        let bibFilePath: string | null = null;
        let citationsFound: string[] = [];
        let citationsMissing: string[] = [];

        if (citeKeys.length > 0) {
            // Generate BibTeX file
            vscode.window.showInformationMessage('Generating bibliography...');

            const bibResult = await generateBibFile(markdown);
            bibFilePath = bibResult.bibFilePath;
            citationsFound = bibResult.citationsFound;
            citationsMissing = bibResult.citationsMissing;

            // Warn about missing citations
            if (citationsMissing.length > 0) {
                const action = await vscode.window.showWarningMessage(
                    `${citationsMissing.length} citation(s) not found in Zotero: ${citationsMissing.slice(0, 3).join(', ')}${citationsMissing.length > 3 ? '...' : ''}`,
                    'Continue Anyway',
                    'Cancel'
                );

                if (action === 'Cancel') {
                    // Clean up temp bib file
                    if (bibFilePath) {
                        await fs.unlink(bibFilePath).catch(() => { /* ignore cleanup errors */ });
                    }
                    return {
                        success: false,
                        citationsFound: citationsFound.length,
                        citationsMissing,
                        error: 'Export cancelled by user'
                    };
                }
            }
        }

        // Get CSL style
        const config = vscode.workspace.getConfiguration('document-viewer');
        const styleName = options.cslStyle || config.get<string>('pandoc.cslStyle', 'apa');
        const cslPath = getCslStylePath(styleName, extensionPath);

        // Build Pandoc command
        const pandocPath = pandocStatus.path || 'pandoc';
        const args: string[] = [
            options.inputPath,
            '-o', options.outputPath,
            '--standalone'
        ];

        // Add citation processing if we have citations
        if (bibFilePath && citationsFound.length > 0) {
            args.push('--citeproc');
            args.push('--bibliography', bibFilePath);

            if (cslPath) {
                // Check if CSL file exists
                try {
                    await fs.access(cslPath);
                    args.push('--csl', cslPath);
                } catch {
                    Output.log(`CSL file not found: ${cslPath}, using Pandoc default`);
                }
            }
        }

        // Add format-specific options
        if (options.outputFormat === 'pdf') {
            // Use default PDF engine (pdflatex, xelatex, etc.)
            // Users can configure this via Pandoc defaults if needed
            args.push('--pdf-engine=xelatex');
        } else if (options.outputFormat === 'docx') {
            // Add custom DOCX template if specified
            const referenceDoc = options.referenceDoc ||
                vscode.workspace.getConfiguration('document-viewer').get<string>('pandoc.referenceDoc', '');

            if (referenceDoc) {
                // Resolve path (could be absolute or workspace-relative)
                let templatePath = referenceDoc;
                if (!path.isAbsolute(referenceDoc)) {
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (workspaceFolders && workspaceFolders.length > 0) {
                        templatePath = path.join(workspaceFolders[0].uri.fsPath, referenceDoc);
                    }
                }

                // Verify template exists before using
                try {
                    await fs.access(templatePath);
                    args.push('--reference-doc', templatePath);
                    Output.log(`Using DOCX template: ${templatePath}`);
                } catch {
                    Output.log(`DOCX template not found: ${templatePath}, using Pandoc default`);
                    vscode.window.showWarningMessage(`DOCX template not found: ${referenceDoc}`);
                }
            }
        }

        // Add any extra arguments
        if (options.extraArgs) {
            args.push(...options.extraArgs);
        }

        // Execute Pandoc
        vscode.window.showInformationMessage(`Exporting to ${options.outputFormat.toUpperCase()}...`);

        await new Promise<void>((resolve, reject) => {
            const proc = spawn(pandocPath, args, {
                shell: true,
                cwd: path.dirname(options.inputPath)
            });

            let stderr = '';

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Pandoc exited with code ${code}: ${stderr}`));
                }
            });

            proc.on('error', (error) => {
                reject(error);
            });
        });

        // Clean up temp bib file
        if (bibFilePath) {
            await fs.unlink(bibFilePath).catch(() => { /* ignore cleanup errors */ });
        }

        vscode.window.showInformationMessage(
            `Export to ${options.outputFormat.toUpperCase()} complete!` +
            (citationsFound.length > 0 ? ` (${citationsFound.length} citations processed)` : '')
        );

        return {
            success: true,
            outputPath: options.outputPath,
            citationsFound: citationsFound.length,
            citationsMissing
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Output.log(`Pandoc export error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Pandoc export failed: ${errorMessage}`);

        return {
            success: false,
            citationsFound: 0,
            citationsMissing: [],
            error: errorMessage
        };
    }
}

/**
 * Get the output path for Pandoc export
 * Uses same directory as input file, with appropriate extension
 */
export function getOutputPath(inputPath: string, format: 'pdf' | 'docx'): string {
    const parsed = path.parse(inputPath);
    return path.join(parsed.dir, `${parsed.name}.${format}`);
}
