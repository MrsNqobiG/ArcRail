import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Home from '@/components/arcrail/home'
import { Toaster } from '@/components/ui/sonner'
import { installApiShim } from './api-shim'
import './styles.css'

installApiShim()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home />
    <Toaster />
  </StrictMode>,
)
