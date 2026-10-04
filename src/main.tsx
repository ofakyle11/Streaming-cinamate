import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import './styles/theme.css';
import './styles/surfaces.css';
import './styles/motion.css';
import { applyPerfLite } from './lib/perfLite';
import { initInstallPrompt } from './pwa/install';

// Capture the PWA install prompt early; the Account page offers it later.
initInstallPrompt();
// Low-memory or data-saver devices drop blur and ambient light (surfaces.css).
applyPerfLite();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);
