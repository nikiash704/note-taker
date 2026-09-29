# Note taker

Keyboard-first math notes. Type Markdown with `$math$`, and simple commands turn into clean figures:

```
/plot sin x from -pi to pi
/triangle ABC right at C
/interval [0,1)
/vec (2,3)
/diagram A -> B -> C
```

Typos are fine (`/trinagle ABC rigth at C` still works), and nothing waits on the network.

This is a **prototype**. It exists to test two questions:
1. Can students draw blackboard figures from keyboard commands fast enough during a lecture?
2. Does typo tolerance feel instant (no waiting, no popups)?

The hidden page **`/stats`** shows what the local usage log says about both.

## Using it

- **Left:** the editor. **Right:** the rendered note. Click a block on the right to jump to it.
- Notes save automatically in your browser (localStorage). **Cmd/Ctrl+S** downloads the note as `.md`. **Open** loads a `.md` file.
- Every figure has a **Download SVG** button (hover over it).
- **Ctrl+/** opens the cheat sheet.

### Figure commands

| Command | Examples |
| --- | --- |
| `/plot` | `/plot sin x from -pi to pi` · `/plot x^2, 2x+1 [-3, 3]` · `/graph cos x -pi..pi` |
| `/axes` | `/axes` · `/axes -3..3` · `/axes x -2..4 y -1..3` · `/axes A(1,2) B(3,-1)` |
| `/vec` | `/vec (2,3)` · `/vec u=(2,3) v=(-1,2)` · `/vec (1,1) -> (3,2)` |
| `/triangle` | `/triangle ABC right at C` · `/triangle PQR isosceles at P` · `/triangle ABC right at C a=3 b=4` · `/triangle ABC AB=5 BC=7 CA=6 A=60` |
| `/interval` | `/interval [0,1)` · `/interval (-inf, 2] U (3, 5]` · `/interval 0 <= x < pi` |
| `/diagram` | `/diagram A -> B -> C` · `/diagram A -f-> B; A -g-> C; B -h-> D; C -k-> D` |

Typo tolerance (deterministic, no AI): edit distance on command names, a synonym table (`/graph`, `/fn` → `/plot`, `/tri` → `/triangle`, …), unique prefixes (`/inter`), and the same forgiveness for keywords and function names inside arguments (`rigth`, `form`, `sni`). If a command can't be read, a one-line hint appears at the end of the line once you move off it. Never a popup.

### Equation shortcuts (inside `$…$`)

Following Obsidian Latex Suite: `x/` → `\frac{x}{}`, `@a` → `\alpha`, `xbar`/`xhat`/`xvec` → `\bar{x}` …, `sqrt`, `int`, `sum`, `lim`, `mat` (Tab = next column, Enter = next row, Enter on an empty row = done), `sin` → `\sin`, `->` → `\to`, `RR` → `\mathbb{R}`, `xsr` → `x^{2}`, and more. **Tab** jumps to the next box, then out of the bracket, then out of the math. `mk` and `dm` start inline and display math. Undo right after an expansion gives back what you typed. The full list is in the cheat sheet.

## Running it locally

Needs Node 22 (see `.node-version`).

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Other scripts:

- `npm test` runs the unit tests (shortcuts, formula reader, figures, typo matching)
- `npm run build` type-checks and builds the static site into `dist/`
- `npm run preview` serves the built site

## Putting it online (GitHub + Cloudflare Pages)

1. Create an empty repository on GitHub (for example `note-taker`), then push:

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/note-taker.git
   git push -u origin main
   ```

2. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git**, pick the repository, and use:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Build output directory: `dist`

   The Node version comes from `.node-version`. There are no environment variables or secrets.

3. Every push to `main` redeploys. `public/_redirects` makes `/stats` work on Pages.

## How the code is laid out

```
src/
  main.ts          picks the page: notes or /stats
  notesApp.ts      the main screen: toolbar, editor, preview, saving
  editor.ts        CodeMirror setup and highlighting of math / figure lines
  markdown.ts      tiny Markdown reader + KaTeX rendering
  preview.ts       the right-hand side; re-renders only changed blocks
  snippets.ts      equation shortcut rules (pure, unit-tested)
  shortcuts.ts     connects the rules to the editor: Tab, Enter, undo
  mathRegions.ts   finds $…$ and $$…$$ in the text
  fuzzy.ts         edit distance and "closest word"
  figureHints.ts   the quiet hints at the end of figure lines
  usageLog.ts      times figure commands as you type them
  logStore.ts      where the log is kept (localStorage)
  stats.ts         the /stats page
  cheatSheet.ts    the Ctrl+/ panel
  figures/
    index.ts       command lookup (typos, synonyms) and running
    expr.ts        forgiving formula reader: sin x, 2x, x^2, |x| (no eval)
    range.ts       "from -pi to pi", "-pi..pi", "[0, 2pi]"
    svg.ts         hand-written SVG helpers, axes and ticks
    plot.ts  plane.ts  triangle.ts  interval.ts  diagram.ts
    element.ts     figure + Download SVG button for the preview
tests/             vitest unit tests
```

Out of scope for this prototype: accounts, sync, collaboration, OCR, mobile, AI, any backend.
