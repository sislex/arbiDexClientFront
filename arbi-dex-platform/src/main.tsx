import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry, AllCommunityModule } from 'ag-charts-community'
import './index.css'
import App from './App.tsx'

ModuleRegistry.registerModules(AllCommunityModule)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
