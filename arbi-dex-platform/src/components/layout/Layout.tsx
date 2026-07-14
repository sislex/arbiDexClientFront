import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { loadCatalogPairSymbols } from '../../services/catalogService'
import { Sidebar } from './Sidebar'
import { TopToolbar } from './TopToolbar'

export function Layout() {
  useEffect(() => {
    void loadCatalogPairSymbols()
  }, [])

  return (
    <div className="h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex h-screen min-h-0 w-full min-w-0 flex-col overflow-hidden pl-60">
        <TopToolbar />
        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
