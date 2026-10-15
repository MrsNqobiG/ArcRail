import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Home from '@/components/arcrail/home'
import { Toaster } from '@/components/ui/sonner'
import { installApiShim } from './api-shim'
import '@fontsource-variable/outfit/wght.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './styles.css'

installApiShim()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home />
    <Toaster />
  </StrictMode>,
)
