# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
yarn build          # Production build (extension + React webview)
yarn dev            # Start Vite dev server for webview (port 5739)
yarn lint:fix       # Fix ESLint issues
yarn package        # Create .vsix package
```

## Project Overview

This is a VS Code extension that provides a WYSIWYG markdown editor using [Vditor](https://github.com/Vanessa219/vditor). The extension registers as a custom editor for `.md` and `.markdown` files.

## Architecture

### Build Pipeline

The build runs two parallel processes via `vite.config.ts`:
1. **Extension bundle** (esbuild via `build.js`) - compiles `src/extension.ts` to `out/extension.js`
2. **React webview** (Vite) - compiles `src/react/main.tsx` to `out/webview/`

### Extension ↔ Webview Communication

The extension uses a message-passing pattern between VS Code and the webview:

- **Handler class** (`src/common/handler.ts`) - Event-based bidirectional communication
  - `handler.emit(event, data)` - Send message to webview
  - `handler.on(event, callback)` - Listen for messages from webview
- **Vditor resources** (`resource/vditor/`) - The markdown editor UI runs in the webview, communicating via `postMessage`

Key events: `init`, `open`, `save`, `doSave`, `update`, `export`, `theme`, `scroll`, `img`, `loadComments`, `openCitationPicker`

### Core Components

| Path | Purpose |
|------|---------|
| `src/extension.ts` | Extension entry point, registers custom editor providers |
| `src/provider/markdownEditorProvider.ts` | Main editor provider (CustomTextEditorProvider) |
| `src/service/markdownService.ts` | Export (PDF/HTML/DOCX), clipboard image handling |
| `src/service/commentService.ts` | Sidecar `.comments` file management |
| `src/service/zotero/` | Zotero citation integration (see below) |
| `src/common/handler.ts` | Webview ↔ Extension message bus |
| `resource/vditor/` | Vditor editor HTML/JS/CSS (loaded into webview) |

### Zotero Integration

The Zotero service reads directly from Zotero's SQLite databases (no API needed):

| File | Purpose |
|------|---------|
| `src/service/zotero/zoteroService.ts` | Singleton service, database connections via sql.js |
| `src/service/zotero/zoteroQueries.ts` | SQL queries for Zotero and Better BibTeX databases |
| `src/service/zotero/zoteroHelpers.ts` | Formatting utilities (authors, citations, item types) |
| `src/service/zotero/zoteroTypes.ts` | TypeScript interfaces |
| `src/service/zotero/bibTexService.ts` | BibTeX generation from Zotero items |

**Dependencies:**
- `sql.js` - WebAssembly SQLite (WASM file copied to `out/` during build)
- Requires Zotero with Better BibTeX plugin installed

**Citation Insertion Flow:**
1. Webview emits `openCitationPicker` event (toolbar button or right-click menu)
2. `ZoteroService.getInstance()` connects to databases
3. `getItems()` queries all items with citation keys
4. VS Code QuickPick displays results
5. Selected citation inserted via `handler.emit("insertMarkdown", "@citekey")`

### Pandoc Export

The Pandoc service enables citation-aware export to PDF/DOCX:

| File | Purpose |
|------|---------|
| `src/service/pandocService.ts` | Pandoc detection, execution, CSL style handling |
| `src/service/zotero/bibTexService.ts` | Extracts citations from markdown, generates .bib files |
| `resource/csl/` | Bundled CSL citation styles (APA, Chicago, Vancouver, etc.) |

**Export Flow:**
1. User selects "Export PDF (with Citations)" from context menu
2. `bibTexService.extractCitations()` finds all `@citekey` references in markdown
3. `bibTexService.generateBibFile()` queries Zotero and creates temp .bib file
4. `pandocService.exportWithPandoc()` runs Pandoc with `--citeproc --bibliography`
5. Output PDF/DOCX includes formatted citations and bibliography

**Dependencies:**
- Pandoc must be installed on the system (`pandoc.org/installing.html`)
- Zotero with Better BibTeX for citation data

### Configuration

All settings use prefix `document-viewer.*` (defined in `package.json` contributes.configuration). Access via:
```typescript
Global.getConfig('editorTheme')  // src/common/global.ts
```

## Conventions

- Use yarn (not npm)
- Commit messages in English, max 70 characters
