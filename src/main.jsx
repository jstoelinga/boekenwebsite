import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// 'basename' moet overeenkomen met de 'base' in vite.config.js
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/boekenwebsite">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
