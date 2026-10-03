import 'katex/dist/katex.min.css';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

// "/stats" is a hidden page (not linked from the app) showing the usage log.
const page = location.pathname.replace(/\/+$/, '');
if (page === '/stats') {
  import('./stats').then(({ renderStats }) => renderStats(app));
} else if (page === '/gallery') {
  import('./gallery').then(({ renderGallery }) => renderGallery(app));
} else {
  import('./notesApp').then(({ startNotes }) => startNotes(app));
}
