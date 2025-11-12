import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './routes/App';
import { purgeLocalStorageIfNeeded } from './lib/storageCleanup';
import './styles/index.css';

purgeLocalStorageIfNeeded();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
