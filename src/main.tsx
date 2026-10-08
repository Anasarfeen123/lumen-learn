import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-500.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/lexend/latin-700.css';
import '@fontsource/gaegu/latin-700.css';
import '@fontsource/patrick-hand/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/opendyslexic/latin-400.css';
import '@fontsource/opendyslexic/latin-700.css';
import './styles/global.css';
import { LumenProvider } from './state/store';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LumenProvider>
      <App />
    </LumenProvider>
  </StrictMode>,
);
