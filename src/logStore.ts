// Where the usage log is kept: localStorage, in this browser only.
// Kept apart from the editor code so the /stats page loads quickly.

import type { MatchKind } from './figures';
import { readJSON, writeJSON } from './storage';

export interface LogEntry {
  /** When the command was committed (ms since 1970). */
  at: number;
  line: string;
  typed: string;
  command: string | null;
  match: MatchKind | null;
  ok: boolean;
  hint?: string;
  /** Auto-corrections made, e.g. ["/trinagle → /triangle", "rigth → right"]. */
  corrections: string[];
  /** First keystroke to last keystroke on the line. */
  typingMs: number;
  /** Time to read the command and draw it. */
  parseMs: number;
  /** Number of edits (keystrokes, pastes, expansions) on the line. */
  edits: number;
  /** True if this line was committed before and failed then. */
  fixedByUser: boolean;
}

const LOG_KEY = 'nt.log';
const MAX_ENTRIES = 5000;

export function readLog(): LogEntry[] {
  return readJSON<LogEntry[]>(LOG_KEY, []);
}

export function clearLog(): void {
  writeJSON(LOG_KEY, []);
}

export function appendLog(entry: LogEntry): void {
  const log = readLog();
  log.push(entry);
  writeJSON(LOG_KEY, log.slice(-MAX_ENTRIES));
}
