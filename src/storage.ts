// Everything the app remembers lives in localStorage. Reads and writes are
// wrapped in try/catch because storage can be disabled (private windows,
// blocked site data) and the app should still work, just without saving.

const NOTE_KEY = 'nt.note';

export function loadNote(): string | null {
  try {
    return localStorage.getItem(NOTE_KEY);
  } catch {
    return null;
  }
}

export function saveNote(text: string): boolean {
  try {
    localStorage.setItem(NOTE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: drop silently, never interrupt typing.
  }
}

/** Trigger a browser download of `content` as a file called `filename`. */
export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
