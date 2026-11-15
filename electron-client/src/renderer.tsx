// Runs in the renderer process (the window's web page), loaded by Vite from index.html.
// Node.js is not available here; anything from the main process must come through preload.ts.
// https://electronjs.org/docs/tutorial/process-model

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
