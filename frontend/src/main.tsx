import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { runtimeConfig } from './runtimeConfig';
import './styles/reset.css';
import './styles/variables.css';
import './styles/app.css';

if (runtimeConfig.dashboardTitle) {
  document.title = runtimeConfig.dashboardTitle;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
