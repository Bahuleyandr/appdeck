import { createRoot } from 'react-dom/client';
import '../styles.css';
import { QuickViewApp } from './QuickViewApp.js';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<QuickViewApp />);
}
