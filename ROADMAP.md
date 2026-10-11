# Visual Markdown Editor — Roadmap

> Living plan and current development state. Updated as milestones progress.
> Workflow: project-workflow skill (`~/.claude/skills/coding/skills/project-workflow/SKILL.md`).
> Status legend: `[ ]` planned · `[~]` in progress · `[x]` complete.

## Current State

- **Tier:** C — Direct (an `extensions/*` repo: land on `master`, no PRs; the publish workflow runs on `v*` tags)
- **Local check:** `yarn lint:fix && yarn typecheck && yarn test && yarn build && yarn package` (what CI runs)
- **Active milestone:** M3 — Comments stay attached to their text
- **Branch:** `master`
- **Next step:** M3 phase 3.5, a manual check in the editor; then release
- **Updated:** 2026-10-11

## Milestones

### M3 — Comments stay attached to their text  `[~] in progress`
Branch: `master`. Today a comment stores a block-index `line` that nothing reads, and the panel only lists comments, so nothing ties a comment to its text.
- [x] 3.1 — Anchor: store the quoted text plus about 32 characters of context on each side (`anchor` in the sidecar, version 1.1); a comment without a selection anchors to its paragraph; pure matching code in `resource/vditor/anchor.js` with unit tests
- [x] 3.2 — Show: highlight anchored text with the CSS Custom Highlight API (no DOM changes, so nothing leaks into the markdown); re-anchor after edits
- [x] 3.3 — Navigate: clicking a comment scrolls to and flashes its text; clicking highlighted text brings up its comment
- [x] 3.4 — Detached comments (a weak context match detaches instead of jumping to another occurrence of the same words): "text not found" in the panel, with re-attach to the current selection; legacy comments anchor by `selectedText`, and comments with neither stay general
- [ ] 3.5 — Check in the editor (Positron/VS Code): add a comment on a selection and on a paragraph, edit around it, edit it away and re-attach; highlight colors in a dark theme

### M2 — Leftover cleanup  `[x] complete`
Branch: `master` · Landed: 2026-10-11 · Released in v2.6.0
- [x] 2.1 — Check the release inside the editor (passed in Positron with 2.6.0 on 2026-10-11; image display was covered by Insert Image and drag-and-drop):
  - the editor renders under the new CSP, and images in the document's folder still show
  - `⇧⌥Z` opens the citation picker, `⌘⇧Z` redoes, and `⌘V` pastes normally in the Search box
  - Insert Citation loads the Zotero library; PDF export works, and so does Pandoc export of a file whose path has spaces
  - a `.qmd` file shows the Export button
  - in the citation picker, checked items stay checked while typing, and recently used citations appear first
  - "Open in Typora" on Windows
- [x] 2.2 — Remaining audit findings (7 advisories in 5 packages on 2026-10-11; done 2026-10-11, 4 advisories left as accepted risks below):
  - `katex` 0.16 (low; prototype pollution can bypass `trust`; fixed in 0.18.2): upgrade, and check that export math still matches the vendored KaTeX CSS
  - `basic-ftp` (high; fixed in 6.2.1) and `extract-zip` (high; no fix released) via `puppeteer-core` → `@puppeteer/browsers`: browser-download code the extension never runs. Try overriding `basic-ftp`; wait for upstream on `extract-zip`
  - `image-size` (high; fixed in 2.0.3) via `vscode-html-to-docx` 1.1.3, the latest, which requires `image-size` ^1 (v2 changed its API): override and test, or route DOCX export through Pandoc
  - `braces` (high; no fix released) via `esbuild-plugin-copy` 1.x: dev-only, and only matches globs in `build.js`. `esbuild-plugin-copy` 2.x still depends on it
- [x] 2.3 — Citation picker (done 2026-10-11; usage history is saved in `globalState`, the boost applies only to relevance order, and picks are reused so checkmarks survive typing):
  - Recently used citations never rise to the top: each picker builds a new `ZoteroSearchService` (`markdownEditorProvider.ts`), so recorded usage is discarded, and nothing saves it between sessions
  - Once usage history works, decide whether it should override an explicit title/author/year sort (`applyUsageBoost` re-sorts after `sortResults`)
  - Typing replaces `quickPick.items`, which likely clears multi-select checkmarks; confirm in VS Code
- [x] 2.4 — Settings (done 2026-10-11):
  - `document-viewer.zotero.showStatusBar` is never read
  - The `document-viewer.editorTheme` enum lists 3 of the 10 themes the theme picker writes, so VS Code flags valid choices as invalid
  - `document-viewer.pandoc.path` and `document-viewer.chromiumPath` should be `"scope": "machine"`, so workspace settings can't point them at another program
- [x] 2.5 — Dead code (removed 2026-10-11, along with the `zotero.linkedAttachmentsBasePath` setting, which only the removed code used):
  - `lib.js` (old dependency bundler) and the root `styles/` folder, which nothing references but is packaged into the `.vsix`; `src/vscode.css`
  - Unused Zotero code: `ZoteroService.getOpenOptions`, `getAttachmentPath` and the deprecated sync `getInstance()`, `getItemsByCiteKeys` in `bibTexService.ts`, and the string-built SQL in `zoteroQueries.ts` that only they use (`queryZoteroKey`, `queryPdfByZoteroKey`, `queryDoiByZoteroKey`, `queryAttachmentPath`)
  - `CommentService.adjustLineNumbers`; the per-editor file watcher in `handler.ts`, whose `fileChange` event nothing listens to; the webview's `dispose` listener, which the extension no longer sends
- [x] 2.6 — Add a typecheck (`tsc --noEmit`) to CI: esbuild and the linter don't type-check, so a type error can ship

Known limitations, not scheduled:
- Accepted audit findings (2026-10-11): `extract-zip` (2 high, no fixed release) is only used by puppeteer to download browsers, which the extension never does; `image-size` (2 high, denial of service on crafted ICNS/JXL/HEIF images) is compiled into `vscode-html-to-docx`'s bundle, so an override wouldn't change the shipped code. Revisit when either upstream releases a fix, or replace the non-Pandoc DOCX export.
- Zotero changes still in `zotero.sqlite-wal` aren't visible until Zotero checkpoints the database, because sql.js reads only the main file.
- Sidecar comments are anchored to line numbers and likely drift when lines are added or removed above them. `CommentService.adjustLineNumbers` was meant for this but was never called (removed in 2.5); the editor replaces the whole document on each change, so there are no per-line edits to adjust from.

### M1 — Modernize and harden (v2.5.0)  `[x] complete`
Branch: `milestone/modernize-and-harden` · Merged: 2026-10-11 · Released as v2.5.0
- [x] 1.1 — Review fixes: Zotero citation keys from Zotero's own database, Pandoc and Typora without a shell, Mermaid in PDF/HTML export, export save and error handling, editor bugs
- [x] 1.2 — Remove the unused React webview and Vite; build with esbuild directly
- [x] 1.3 — Require VS Code 1.96; pin `@types/vscode`; `file-type` 21
- [x] 1.4 — Bundle the Vditor renderers; fix editor syntax highlighting
- [x] 1.5 — Harden the webview: CSP, resource roots, link policy, Mermaid strict mode
- [x] 1.6 — Shortcut fixes: Insert Citation to `Shift+Alt+Z`, narrower `⌘V`, `.qmd` support
- [x] 1.7 — ESLint 10 flat config
- [x] 1.8 — puppeteer-core 24

## Detail Documents

- [CLAUDE.md](CLAUDE.md) — architecture, vendored Vditor sources and local patches, conventions
- [changelog.md](changelog.md) — release notes

## Changelog

- 2026-10-11 — M3 phases 3.1–3.4 done on `master` (browser-harness verified).
- 2026-10-11 — M3 planned: anchor comments to their text.
- 2026-10-11 — M2 complete: the manual checks (2.1) passed in Positron.
- 2026-10-11 — Released v2.6.0 with M2 phases 2.2–2.6.
- 2026-10-11 — M2 phases 2.2–2.6 complete on `master` (audit findings, citation picker, settings, dead code, CI typecheck); 2.1 awaits a manual check.
- 2026-10-11 — M1 complete: merged `milestone/modernize-and-harden` into `master` and released v2.5.0. Roadmap created; M2 lists the leftovers.
