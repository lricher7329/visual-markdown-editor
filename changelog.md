# Changelog

All notable changes to the Visual Markdown Editor extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2026-10-11

### Changed
- **Insert Zotero Citation is now `Shift+Alt+Z`** (`⇧⌥Z` on macOS, the shortcut the Citation Picker for Zotero extension uses). The old `Ctrl/Cmd+Shift+Z` shadowed Redo in the editor.
- Requires VS Code 1.96 or later. Export already depended on Node 20.18.1 (via `cheerio`), which VS Code first ships in 1.96; the manifest now says so.
- Mermaid, code highlighting, Graphviz, ECharts, ABC notation and flowchart renderers are bundled with the extension instead of loaded from unpkg.com, so they render offline and where unpkg is slow or blocked.
- PDF export uses puppeteer-core 24 (was 1.20 from 2019).
- Removed unused dependencies (`axios`, `iconv-lite`, `date-format`) and `markdown-it-mermaid`; the extension bundle shrinks from about 1.1 MB to 0.4 MB, and development files are no longer packaged into the `.vsix`.
- Development: removed the unused React webview along with React, antd and Vite (`yarn build` and `yarn dev` run `build.js` directly); linting moved to ESLint 10 with `eslint.config.js` (8 and 9 are end-of-life) and now covers every TypeScript file; upgraded `vitest` to 4, `esbuild` to 0.28 and `file-type` to 21; CI and publish workflows run on Node 24; dependencies refreshed, clearing all critical and most high-severity audit findings.

### Fixed
- Zotero citations failed to load with current Better BibTeX, which moved citation keys out of `better-bibtex.sqlite` into Zotero's own `citationKey` field. Keys are now read from Zotero's database; a legacy `better-bibtex.sqlite` is still used when present.
- Zotero auto-detection never found a custom data directory on macOS and Windows (profile paths in `profiles.ini` were resolved against the wrong folder), and now falls back to `~/Zotero` when the configured directory is stale.
- New Zotero items appear without a manual refresh: the library reloads when Zotero's database file changes. The library query is also about 3× faster.
- Code blocks in the editor had no syntax highlighting: the editor requested highlight.js files that the CDN package it pointed to doesn't contain.
- PDF/HTML export turned newer Mermaid diagram types (`flowchart`, `pie`, `erDiagram`, `stateDiagram`, ...) into "Parse error" text. Export no longer pre-validates with a bundled Mermaid 7; diagrams render with Mermaid 11 and PDF export waits for them to finish rendering.
- Pandoc export failed for files whose path contains spaces, and file names were interpreted by the shell. Pandoc now runs without a shell, and its temporary bibliography is removed even when the export fails.
- Citation export (Pandoc) no longer reports e-mail addresses, URLs and code such as `@decorator` or `@media` as missing citations, includes group-library items regardless of the picker's library filter, and no longer corrupts backslashes in BibTeX fields.
- Exports now wait for the document to be saved, so unsaved edits are included.
- HTML and DOCX export no longer require a Chromium browser to be installed.
- Export failures now show an error message instead of failing silently (or reporting success); the headless browser is always closed and the temporary HTML file removed, even when the browser fails to start.
- "Open in Typora" launches Typora directly instead of typing a command into a hidden terminal, which ran the file name through the shell and failed in PowerShell on Windows; it now reports when Typora cannot be found.
- "Switch markdown editor" opened a view type left over from the upstream extension and did nothing.
- Dropping or uploading the first image into a document failed because its image folder did not exist yet; the image link is now inserted without overwriting the clipboard.
- Insert Citation from the command palette no longer targets a closed editor.
- `.qmd` files (and `.md` files opened with "Markdown Editor (Optional)") get the Insert Citation shortcut and the Export button; `.markdown` files get the Switch Editor button.
- The image-aware `Ctrl/Cmd+V` no longer takes over paste in the Search box, terminal, panels or Quick Open while a markdown file is open.

### Security
- The editor webview now has a Content Security Policy: only the extension's own scripts run, so inline script injection (for example `onerror=` attributes or `javascript:` links) is blocked.
- The editor can only read files in the extension, the document's folder and the workspace. Turning on `document-viewer.viewAbsoluteLocal` restores access to the whole disk for absolute image paths. Insert Image offers to copy a picture from elsewhere into the document's image folder.
- Links other than `http`, `https`, `mailto` and `zotero` ask before opening.
- Mermaid diagrams render in strict mode (no HTML labels beyond line breaks, no click handlers).
- The editor webview can only ask the extension to run the one command it uses, instead of any VS Code command.

## [2.4.1] - 2026-04-26

### Fixed
- Mermaid diagrams (sequenceDiagram, flowchart, gantt, etc.) failing to render because the configured CDN package `vscode-vditor@3.11.2` does not exist on npm (404). Switched to upstream `vditor@3.11.2`, which version-matches the bundled Vditor build. Fixes [#1](https://github.com/lricher7329/visual-markdown-editor/issues/1).

## [2.4.0] - 2026-02-06

### Added
- Support for `.qmd` (Quarto markdown) files as an optional editor
- Editable language label on code blocks (appears below block on hover, click to change language)

### Fixed
- Stray character overlapping "Copy" button on code blocks (hidden Vditor's built-in copy overlay)
- Copy button and language label now appear on newly inserted code blocks (debounced observer)

## [2.3.5] - 2026-01-31

### Fixed
- Removed stray upload arrow (↑) from insert toolbar dropdown menu
- Added Cmd/Ctrl+K keyboard shortcut for link insertion

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
