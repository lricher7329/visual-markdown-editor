# Visual Markdown Editor — Roadmap

> Living plan and current development state. Updated as milestones progress.
> Workflow: project-workflow skill (`~/.claude/skills/coding/skills/project-workflow/SKILL.md`).
> Status legend: `[ ]` planned · `[~]` in progress · `[x]` complete.

## Current State

- **Tier:** C — Direct (an `extensions/*` repo: land on `master`, no PRs; the publish workflow runs on `v*` tags)
- **Local check:** `yarn lint:fix && yarn typecheck && yarn test && yarn build && yarn package` (what CI runs)
- **Active milestone:** M2 — Leftover cleanup
- **Branch:** `master`
- **Next step:** M2 phases 2.2–2.6 in progress on `master`; phase 2.1 is a manual check in VS Code
- **Updated:** 2026-10-11

## Milestones

### M2 — Leftover cleanup  `[~] in progress`
Branch: `master`
- [ ] 2.1 — Check 2.5.0 inside VS Code; these couldn't be tested outside it:
  - the editor renders under the new CSP, and images in the document's folder still show
  - `⇧⌥Z` opens the citation picker, `⌘⇧Z` redoes, and `⌘V` pastes normally in the Search box
  - Insert Citation loads the Zotero library; PDF export works, and so does Pandoc export of a file whose path has spaces
  - a `.qmd` file shows the Export button
  - in the citation picker, checked items stay checked while typing, and recently used citations appear first
  - "Open in Typora" on Windows
- [ ] 2.2 — Remaining audit findings (7 advisories in 5 packages on 2026-10-11):
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

- 2026-10-11 — M1 complete: merged `milestone/modernize-and-harden` into `master` and released v2.5.0. Roadmap created; M2 lists the leftovers.
