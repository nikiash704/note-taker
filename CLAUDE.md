# Note taker — keyboard-first math notes

## What this is
A web app for taking math lecture notes on a laptop using only the keyboard. The core idea: simple typed commands produce clean figures (graphs, geometry, diagrams), and the app forgives typos in those commands, so students keep up with the lecturer.

This is a **prototype**. Its job is to test two things:
1. Can students draw blackboard figures from keyboard commands fast enough during a lecture?
2. Does typo-tolerance feel instant (no waiting, no popups)?

## Stack
- Vite + TypeScript, no framework unless clearly needed
- CodeMirror 6 for the editor
- KaTeX for math rendering
- Figures rendered as inline SVG (hand-written SVG generation; no heavy charting libraries)
- Static site, deployed to Cloudflare Pages from GitHub. No backend yet.

## Features, in build order
1. **Editor**: plain text + `$...$` inline and `$$...$$` block math, rendered live. Notes saved as Markdown in the browser (localStorage) with a download button.
2. **Equation shortcuts** (~25), following Obsidian Latex Suite conventions:
   - `/` after a term → `\frac{term}{}` with cursor in denominator
   - Tab jumps out of the current bracket/argument
   - `@a` → `\alpha`, `@b` → `\beta`, etc.
   - postfix accents: `xbar` → `\bar{x}`, `xhat` → `\hat{x}`, `xvec` → `\vec{x}`
   - `int`, `sum`, `lim`, `sqrt`, `mat` (matrix with Tab/Enter navigation)
3. **Figure commands** — a line starting with `/` is a figure command, rendered as SVG below it:
   - `/plot sin(x) from -pi to pi`
   - `/axes` and `/vec (2,3)`
   - `/triangle ABC right at C`
   - `/interval [0,1)`
   - `/diagram A -> B -> C`
4. **Typo tolerance** — deterministic, must run in under 10ms:
   - edit-distance matching on command names (`/trinagle` → `/triangle`)
   - synonym table (`/graph`, `/fn` → `/plot`; `/tri` → `/triangle`)
   - loose argument parsing (`sin x`, `sin(x)`, `-pi..pi`, `-pi to pi` all accepted)
   - if a command can't be parsed, show a quiet inline hint, never a modal
   - NO LLM calls in this version
5. **Export**: Markdown file, and each figure downloadable as SVG.
6. **Local usage log**: time per command, failed commands, corrections. Stored locally, viewable on a hidden `/stats` page.

## Out of scope for now
Accounts, cloud sync, collaboration, OCR, mobile, payments, AI summaries, any backend or API keys.

## Principles
- Speed is the product. Nothing the user types should wait on the network.
- Eyes stay on the board: no popups, no dialogs during typing.
- Keep the code simple and readable; the owner is learning as they go.
- After each feature: run the dev server, check it works, commit with a clear message.
