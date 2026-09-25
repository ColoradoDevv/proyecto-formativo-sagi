import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/global.css'
import App from './app/App.jsx'
import { ThemeProvider } from '@/shared/contexts/ThemeContext'
import { DirtyFormProvider } from '@/shared/contexts/DirtyFormContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <DirtyFormProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DirtyFormProvider>
    </ThemeProvider>
  </StrictMode>,
)
