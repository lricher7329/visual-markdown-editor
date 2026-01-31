# Changelog

All notable changes to the Visual Markdown Editor extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.4] - 2026-01-31

### Changed
- Bumped minimum VS Code engine version from ^1.64.0 to ^1.75.0
- Removed explicit `activationEvents` array (VS Code ≥1.75 auto-generates from contribution declarations)

## [2.3.3] - 2026-01-31

### Fixed
- Extension failing to open markdown files due to esbuild 0.24 adding `"use strict"` to CJS output, which broke D3 v3 (transitive dependency via mermaid) IIFE patterns
- Added explicit `onCustomEditor` activation events for compatibility with VS Code < 1.75

## [2.3.2] - 2026-01-31

### Changed
- CI/CD workflows now install vsce/ovsx before package step
- Added yarn.lock to repository for reproducible builds

## [2.3.1] - 2026-01-31

### Changed
- Configuration section title now reads "Visual Markdown Editor" instead of "Document Viewer"
- Activation event changed from `onStartupFinished` to `onLanguage:markdown` for faster VS Code startup
- ESLint rules tightened: `no-explicit-any`, `no-empty-function`, `no-unused-vars`, and `no-this-alias` now warn instead of being disabled
- Enabled TypeScript strict mode with `skipLibCheck` and `moduleResolution: "node"`
- Updated esbuild from `^0.14.54` to `^0.24.0` and migrated build script to the new `context()` / `watch()` API
- Zotero logger now writes exclusively to the VS Code Output channel (removed console.log fallback)

### Added
- Marketplace keywords: `wysiwyg`, `vditor`, `zotero`, `citation`, `pandoc`, `export` for improved discoverability
- Type declarations for `sql.js` and `markdown-pdf.js` (`src/types/vendor.d.ts`)
- Troubleshooting section in README (Zotero, Pandoc, PDF export, editor association)
- Development setup section in README
- TypeScript added as an explicit devDependency

### Fixed
- Resolved `Uri | undefined` type error in `switchEditor` method
- Replaced `as any` cast with proper type narrowing in `MarkdownEditorProvider`
- Added comments to empty `.catch()` callbacks in `pandocService` to satisfy lint

### Removed
- Deleted orphaned `shortcut.md` (Vditor upstream keyboard shortcuts reference)
- Cleaned stale `.vscodeignore` patterns (`packages/`, `template/`, `vditor/`, `public/`, `lib.js`)
- Added `build.ts` and `yarn.lock` to `.vscodeignore` to reduce package size

## [2.3.0] - 2026-01-31

### Added

#### WYSIWYG Markdown Editor
- Full WYSIWYG editing powered by [Vditor](https://github.com/Vanessa219/vditor)
- Registers as a custom editor for `.md` and `.markdown` files
- Toolbar with formatting, structure, insert, and view controls
- Live document outline with toggle visibility
- Find in document (Ctrl+F / Cmd+F) with navigation
- Zoom controls (50%-200%) via keyboard (Ctrl+/Ctrl-) and mouse (Ctrl+scroll)
- Status bar with character, word, line, and page count (cyclic display mode)
- Scroll position auto-save and restore
- Enhanced paste with clipboard image support
- Switch between WYSIWYG and default VS Code text editor (Ctrl+Alt+E / Ctrl+Cmd+E)

#### Editor Themes
- 10 editor themes: Auto, Light, Solarized, Warm Light, Dim Light, One Dark, GitHub Dark, Nord, Monokai, Dracula
- 2 contributed VS Code color themes: One Dark Modern, One Dark Modern Classic
- Office Material Icon Theme
- 40+ syntax highlighting styles for code blocks (including Dracula, Monokai, GitHub, and more)

#### Zotero Citation Integration
- Direct SQLite database reading via sql.js (WASM) — no API or server required
- Better BibTeX plugin integration for citation keys
- Auto-detection of Zotero installation across macOS, Windows, and Linux
- Fuzzy search with Fuse.js for fast citation lookup
- Advanced search operators: `author:`, `year:`, `tag:`, `journal:`, `collection:`, `type:`
- Sort options: relevance, date added, date modified, year, title, author
- Usage history tracking with recently/frequently used items ranked higher
- Multi-select citation insertion
- Configurable cache with TTL (1-60 minutes)
- Library filtering: all, personal, or group libraries
- Status bar indicator for Zotero connection state
- Insert citation keybinding: Ctrl+Shift+Z / Cmd+Shift+Z

#### Export
- PDF export via Puppeteer Core with auto-detected Chromium (Edge, Chrome, Brave)
- HTML export
- DOCX export via vscode-html-to-docx
- PDF with citations via Pandoc + citeproc + bibliography
- DOCX with citations via Pandoc with custom reference document templates
- Configurable PDF margins
- Custom Chromium path configuration

#### Pandoc Integration
- Auto-detection of Pandoc installation
- Citation processing with `--citeproc` and `--bibliography` flags
- 6 bundled CSL citation styles: APA, Chicago Author-Date, Vancouver, IEEE, Nature, MLA
- Support for custom CSL files and DOCX reference templates
- Automatic BibTeX generation from Zotero for cited references
- Warning for missing citations during export

#### Document Comments
- Sidecar `.comments` file storage alongside markdown documents
- Line-based comments with selected text context
- Full CRUD operations (add, update, delete)
- JSON format with version tracking

#### Image Handling
- Paste images directly from clipboard into the editor
- Platform-specific clipboard scripts (AppleScript on macOS, PowerShell on Windows, xclip on Linux)
- Auto-detection of image type with file extension correction
- Configurable image save path with template variables (`${fileName}`, `${now}`, `${workspaceDir}`)
- File picker for manual image insertion

#### Rich Content Support
- KaTeX math formula rendering
- Mermaid diagram support
- PlantUML diagram support
- Code blocks with syntax highlighting and optional line numbers

#### Configuration
- Editor theme, language (en, ja, ko, ru, zh-CN, zh-TW), and toolbar visibility
- Code highlight style and line number display
- Image paste path template
- Zotero database paths, library filtering, cache TTL, and status bar toggle
- Pandoc path, CSL citation style, and DOCX template
- Workspace-relative image base path option

#### Commands
- `Switch markdown editor` — toggle between WYSIWYG and text editor
- `Enhance paste in markdown` — clipboard image paste
- `Detect Zotero Installation` — find Zotero data directory
- `Refresh Zotero Library` — reload Zotero database cache
- `Show Zotero Log` — open Zotero output channel
- `Insert Zotero Citation` — open citation picker
- `Open in Typora` — launch current file in Typora
- `Export...` — export to PDF, HTML, DOCX (with or without citations)
- `Cycle count display` — cycle status bar word/char/line/page count

#### Architecture
- Extension + React webview dual-build pipeline (esbuild + Vite)
- EventEmitter-based bidirectional message bus between extension and webview
- Type-safe message protocol with discriminated unions
- Ant Design UI components in webview
- Modular service layer (Markdown, Comment, Zotero, Pandoc)

[2.3.2]: https://github.com/lricher7329/visual-markdown-editor/releases/tag/v2.3.2
[2.3.1]: https://github.com/lricher7329/visual-markdown-editor/releases/tag/v2.3.1
[2.3.0]: https://github.com/lricher7329/visual-markdown-editor/releases/tag/v2.3.0
