// COMMANDS.md is generated from the command registry, so it can't drift.
// Regenerate with: npm run docs
import { it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { COMMANDS, SYNONYMS } from '../src/figures';

function commandsDoc(): string {
  const areas = [...new Set(COMMANDS.map((c) => c.area))];
  const synonymsFor = (name: string) => Object.entries(SYNONYMS).filter(([, t]) => t === name).map(([s]) => `/${s}`);
  const computes = COMMANDS.filter((c) => c.suggest).map((c) => `/${c.name}`);
  let md = `# Figure commands\n\n`;
  md += `_Generated from the code by \`npm run docs\`. ${COMMANDS.length} commands._\n\n`;
  md += `A line starting with \`/\` is a figure or a maths block. Details go on \`+\` lines below it (Shift+Enter starts one), or on the same line after \`;\` — both mean the same.\n\n`;
  md += `**Compute switch.** These commands can work out answers, which are only ever shown as suggestions (Tab accepts): ${computes.join(', ')}.\n\n`;
  md += `## Contents\n\n${areas.map((a) => `- [${a}](#${a.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/ /g, '-')})`).join('\n')}\n\n`;
  for (const area of areas) {
    md += `## ${area}\n\n`;
    for (const c of COMMANDS.filter((x) => x.area === area)) {
      md += `### /${c.name}\n\n${c.description}\n\n\`\`\`\n${c.example}\n\`\`\`\n\n`;
      const syn = synonymsFor(c.name);
      if (syn.length) md += `Also: ${syn.join(', ')}\n\n`;
    }
  }
  return md;
}

it('COMMANDS.md is up to date', () => {
  const md = commandsDoc();
  if (process.env.UPDATE_DOCS) writeFileSync('COMMANDS.md', md);
  expect(readFileSync('COMMANDS.md', 'utf8')).toBe(md);
});
