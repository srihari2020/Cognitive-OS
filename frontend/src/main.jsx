import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const isOverlayRoute = new URLSearchParams(window.location.search).get('overlay') === '1';

if (window.electronAssistant) {
  document.body.classList.add('electron-overlay');
  if (isOverlayRoute) {
    document.body.classList.add('overlay-mode');
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
