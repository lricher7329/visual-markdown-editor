/**
 * Configuration key constants for the extension.
 * These map to the settings defined in package.json under contributes.configuration.
 */
export const ConfigKeys = {
    /** Support view absolute path image from markdown viewer */
    viewAbsoluteLocal: 'viewAbsoluteLocal',
    /** Set the chromium browser location for exporting markdown pdf */
    chromiumPath: 'chromiumPath',
    /** Printed pdf default top margin */
    pdfMarginTop: 'pdfMarginTop',
    /** Open markdown outline */
    openOutline: 'openOutline',
    /** Hide markdown toolbar */
    hideToolbar: 'hideToolbar',
    /** Preview code in markdown */
    previewCode: 'previewCode',
    /** Prevent MacOS option key in the markdown editor */
    preventMacOptionKey: 'preventMacOptionKey',
    /** The theme for the Markdown editor */
    editorTheme: 'editorTheme',
    /** Default syntax highlight style of markdown preview code */
    previewCodeHighlightStyle: 'previewCodeHighlight.style',
    /** Show line numbers in markdown preview code window */
    previewCodeHighlightShowLineNumber: 'previewCodeHighlight.showLineNumber',
    /** Editor UI language */
    editorLanguage: 'editorLanguage',
    /** Using workspace path as markdown image base path */
    workspacePathAsImageBasePath: 'workspacePathAsImageBasePath',
    /** Markdown paste image path template */
    pasterImgPath: 'pasterImgPath',
} as const;

export type ConfigKey = typeof ConfigKeys[keyof typeof ConfigKeys];

/**
 * The configuration prefix used in package.json
 */
export const CONFIG_PREFIX = 'document-viewer';

/**
 * Available editor themes
 */
export const EditorThemes = [
    "Auto",
    "Light",
    "Solarized",
    "Warm Light",
    "Dim Light",
    "One Dark",
    "Github Dark",
    "Nord",
    "Monokai",
    "Dracula",
] as const;

export type EditorTheme = typeof EditorThemes[number];

/**
 * Debounce delay for save operations (in milliseconds)
 */
export const SAVE_DEBOUNCE_MS = 800;
