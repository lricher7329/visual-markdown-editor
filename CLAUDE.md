# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
yarn build          # Production build (esbuild via build.js)
yarn dev            # Rebuild the extension on change (esbuild watch)
yarn test           # Run unit tests (vitest)
yarn lint:fix       # Fix ESLint issues
yarn typecheck      # Type-check with tsc (esbuild does not)
yarn package        # Create .vsix package
```

## Project Overview

This is a VS Code extension that provides a WYSIWYG markdown editor using [Vditor](https://github.com/Vanessa219/vditor). The extension registers as a custom editor for `.md` and `.markdown` files.

## Architecture

### Build Pipeline

`build.js` runs esbuild directly:
1. **Extension bundle** - compiles `src/extension.ts` to `out/extension.js`; `copyAssets()` then copies the PDF templates, the sql.js WASM file, and KaTeX's stylesheet and fonts (used by export, matching the `katex` package) into `out/`
2. **Runtime libraries** - bundles each package listed in `dependencies` at the top of `build.js` into `out/node_modules/<name>.js`; these stay external to the extension bundle and are loaded with `require()` at runtime

The webview UI is static: `resource/vditor/` is loaded as-is, with no build step.

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
| `resource/vditor/anchor.js` | Comment anchors: quote plus context, re-found after edits (highlighting in `util.js`) |
| `src/service/zotero/` | Zotero citation integration (see below) |
| `src/common/handler.ts` | Webview ↔ Extension message bus |
| `resource/vditor/` | Vditor editor HTML/JS/CSS (loaded into webview) |

### Vendored Vditor

`resource/vditor/` is a static copy of the editor. Vditor loads every renderer from its `cdn` option, which `index.js` points at `resource/vditor` itself, so the editor makes no network requests.

| Path | Source |
|------|--------|
| `vditor.js`, `vditor.css`, `lute.min.js` | Custom build of the `vscode-vditor` 3.8.19 fork (`VDITOR_VERSION` 3.8.19); not identical to the published package. Local patch in `vditor.js`: Mermaid `securityLevel:"strict"` (was `"loose"`); re-apply it after replacing the file |
| `dist/js/{i18n,icons,katex}` | `vscode-vditor@3.8.19` (KaTeX fonts trimmed to woff2) |
| `dist/js/{highlight.js,graphviz,echarts,abcjs,flowchart.js,plantuml}` | `vscode-vditor@3.8.19` npm package |
| `dist/js/mermaid/mermaid.min.js` | `vditor@3.11.2` npm package (Mermaid 11.6.0) |

`index.html` sets a Content-Security-Policy (scripts only from the extension; `{{cspSource}}` is filled in by the provider), and the webview can only read the extension's `resource/`, the document's folder and the workspace, plus the whole disk when `document-viewer.viewAbsoluteLocal` is on.

When updating any of these, take renderer files from the package version that matches `vditor.js`: file names differ between Vditor releases (3.8 loads `highlight.js/highlight.pack.js` and `styles/<name>.css`; 3.11 ships `highlight.min.js` and `styles/<name>.min.css`).

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
- When bumping the version in `package.json`, always:
  1. Add a corresponding entry to `changelog.md` following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format
  2. After committing, create and push a git tag (`git tag -m "v<version>" v<version> && git push origin v<version>`) to trigger the publish workflow. Tags are GPG-signed (`tag.gpgSign`), so a bare `git tag v<version>` fails without a message
