import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './routes/App';
import { startAppUpdateCheck } from './lib/appUpdateCheck';
import { purgeLocalStorageIfNeeded } from './lib/storageCleanup';
import './styles/index.css';

purgeLocalStorageIfNeeded();
startAppUpdateCheck();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
