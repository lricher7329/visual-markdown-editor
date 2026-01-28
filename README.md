# Markdown Editor

A VS Code extension for WYSIWYG markdown editing, powered by [Vditor](https://github.com/Vanessa219/vditor).

## Features

- **WYSIWYG editing** - See formatted output as you type
- **Find in document** - Search with `Ctrl/Cmd+F`, navigate with Enter/Shift+Enter
- **Live outline** - Navigate large documents easily
- **Zoom controls** - Toolbar buttons, keyboard shortcuts, and mouse wheel zoom
- **Comments** - Add comments to your documents (stored in sidecar `.comments` files)
- **Image paste** - Paste images directly from clipboard
- **Math support** - KaTeX for mathematical formulas
- **Code highlighting** - Syntax highlighting for code blocks
- **Mermaid diagrams** - Render diagrams and flowcharts
- **Open in Typora** - Launch the current document in Typora for distraction-free writing
- **Zotero citations** - Insert citations from your Zotero library (requires Better BibTeX)
- **Export with citations** - Export to PDF/DOCX with formatted bibliography via Pandoc

## Zotero Integration

Insert citations directly from your Zotero library:

1. Click the **citation button** in the toolbar, use the Insert menu, or right-click and select **Insert Citation**
2. Search your Zotero library by author, title, or citation key
3. Select a reference to insert a Pandoc-style citation (`@citekey`)

**Requirements:**

- [Zotero](https://www.zotero.org/) must be installed
- [Better BibTeX](https://retorque.re/zotero-better-bibtex/) plugin must be installed in Zotero

**Configuration:**

| Setting                                       | Description                    | Default                           |
| --------------------------------------------- | ------------------------------ | --------------------------------- |
| `document-viewer.zotero.enabled`            | Enable Zotero integration      | `true`                          |
| `document-viewer.zotero.zoteroDbPath`       | Path to Zotero database        | `~/Zotero/zotero.sqlite`        |
| `document-viewer.zotero.betterBibtexDbPath` | Path to Better BibTeX database | `~/Zotero/better-bibtex.sqlite` |

## Exporting

Export your markdown to PDF, DOCX, or HTML:

1. Right-click in the editor and select **Export...**
2. Choose format:
   - **PDF/DOCX (with Citations)** - Uses Pandoc with bibliography processing
   - **PDF/DOCX** - Standard export without citation processing
   - **HTML** - Web format
3. For citation exports: select citation style from bundled styles or browse for a custom `.csl` file
4. For DOCX: optionally select a custom Word template

**Requirements:**

- [Pandoc](https://pandoc.org/installing.html) must be installed
- For PDF export: A LaTeX distribution (e.g., TeX Live, MiKTeX) with XeLaTeX

**Bundled Citation Styles:**

- APA (default)
- Chicago Author-Date
- Vancouver
- IEEE
- Nature
- MLA

**Custom Styles and Templates:**

- **Custom CSL**: Set `pandoc.cslStyle` to an absolute path or workspace-relative path to any `.csl` file
- **Custom DOCX Template**: Set `pandoc.referenceDoc` to a Word document that defines your preferred fonts, margins, and styles. See [Pandoc documentation](https://pandoc.org/MANUAL.html#option--reference-doc) for details.

**Configuration:**

| Setting                                 | Description                                  | Default  |
| --------------------------------------- | -------------------------------------------- | -------- |
| `document-viewer.pandoc.enabled`      | Enable Pandoc export                         | `true` |
| `document-viewer.pandoc.path`         | Custom Pandoc path (auto-detect if empty)    |          |
| `document-viewer.pandoc.cslStyle`     | Citation style name or path to `.csl` file | `apa`  |
| `document-viewer.pandoc.referenceDoc` | Path to custom DOCX template                 |          |

## Writing as Code

Markdown is a powerful approach to documentation that treats writing as code. Your documents live alongside your source files, can be version-controlled with Git, and are easily diffed and merged.

**This workflow is particularly well-suited for AI-assisted development:**

- AI coding agents can read, write, and edit markdown files directly
- Documentation stays in sync with code changes in the same commit
- Plain text format means AI can understand and modify content without special tooling
- WYSIWYG preview lets you verify AI-generated documentation looks correct

## Keyboard Shortcuts

| Action                   | Windows/Linux    | macOS           |
| ------------------------ | ---------------- | --------------- |
| Find                     | `Ctrl+F`       | `Cmd+F`       |
| Zoom in                  | `Ctrl++`       | `Cmd++`       |
| Zoom out                 | `Ctrl+-`       | `Cmd+-`       |
| Reset zoom               | `Ctrl+0`       | `Cmd+0`       |
| Switch to VS Code editor | `Ctrl+Alt+E`   | `Ctrl+Cmd+E`  |
| Save                     | `Ctrl+S`       | `Cmd+S`       |
| Paste plain text         | `Ctrl+Shift+V` | `Cmd+Shift+V` |

## Toolbar

The toolbar provides quick access to common formatting and features:

| Section    | Tools                                                            |
| ---------- | ---------------------------------------------------------------- |
| Structure  | Outline toggle, Headings                                         |
| Formatting | Bold, Italic, Strikethrough                                      |
| Lists      | Bullet list, Numbered list, Checkbox                             |
| Insert     | Table, Insert menu (Link, Image, Quote, Code, Inline code, Line) |
| View       | Find, Zoom out, Zoom in                                          |
| Tools      | Comment, Citation (Zotero), Open in Typora, Edit in VS Code      |

## Zoom Controls

Multiple ways to adjust text size:

- **Toolbar buttons** - Click `-` / `+` buttons, or click the percentage to reset
- **Keyboard shortcuts** - `Ctrl/Cmd + +/-/0`
- **Mouse wheel** - Hold `Ctrl/Cmd` and scroll

Zoom range: 50% to 200%

## Tips

- **Open links**: `Ctrl/Cmd + click` or double-click
- **Comments**: Click the comment icon to add notes to selected text
- **Open in Typora**: Click the Typora icon to edit in Typora (must be installed)
- **Context menu**: Right-click for Copy, Paste, Insert Citation, and Export

## Using the Default VS Code Editor

If you prefer the built-in VS Code markdown editor, add this to your `settings.json`:

```json
{
    "workbench.editorAssociations": {
        "*.md": "default",
        "*.markdown": "default"
    }
}
```

Or use "Open With..." to choose an editor per file.

## Configuration

| Setting                                       | Description                     | Default                           |
| --------------------------------------------- | ------------------------------- | --------------------------------- |
| `document-viewer.editorLanguage`            | Editor UI language              | `en_US`                         |
| `document-viewer.editorTheme`               | Editor color theme              | `Auto`                          |
| `document-viewer.openOutline`               | Show document outline           | `true`                          |
| `document-viewer.hideToolbar`               | Hide the toolbar                | `false`                         |
| `document-viewer.previewCode`               | Enable code preview             | `true`                          |
| `document-viewer.pasterImgPath`             | Path template for pasted images | `image/${fileName}/${now}.png`  |
| `document-viewer.zotero.enabled`            | Enable Zotero integration       | `true`                          |
| `document-viewer.zotero.zoteroDbPath`       | Path to Zotero database         | `~/Zotero/zotero.sqlite`        |
| `document-viewer.zotero.betterBibtexDbPath` | Path to Better BibTeX database  | `~/Zotero/better-bibtex.sqlite` |
| `document-viewer.pandoc.enabled`            | Enable Pandoc export            | `true`                          |
| `document-viewer.pandoc.path`               | Custom Pandoc path              | (auto-detect)                     |
| `document-viewer.pandoc.cslStyle`           | Citation style or path to .csl  | `apa`                           |
| `document-viewer.pandoc.referenceDoc`       | Path to DOCX template           |                                   |

## Credits

- Markdown editor: [Vanessa219/vditor](https://github.com/Vanessa219/vditor)
- Icons: [VS Code Codicons](https://microsoft.github.io/vscode-codicons/)
- Icon theme: [PKief/vscode-material-icon-theme](https://github.com/PKief/vscode-material-icon-theme)

## License

MIT
