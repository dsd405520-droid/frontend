import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { patchDomForTranslate } from './utils/patchDomForTranslate.js'
import './index.css'
import App from './App.jsx'

// Must run before the first render, so React never hits a raw
// removeChild/insertBefore call once Google Translate has touched the DOM.
patchDomForTranslate()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
