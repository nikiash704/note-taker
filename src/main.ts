import 'katex/dist/katex.min.css';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

// "/stats" is a hidden page (not linked from the app) showing the usage log.
if (location.pathname.replace(/\/+$/, '') === '/stats') {
  import('./stats').then(({ renderStats }) => renderStats(app));
} else {
  import('./notesApp').then(({ startNotes }) => startNotes(app));
}
