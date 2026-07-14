import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Brain,
  Bot,
  Activity,
  BarChart3,
  History,
  Settings,
  Zap,
} from 'lucide-react'
import { useAppPreferences } from '../../context/AppPreferencesContext'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/pairs', icon: ArrowLeftRight, labelKey: 'tradingPairs' },
  { to: '/strategies', icon: Brain, labelKey: 'strategies' },
  { to: '/bots', icon: Bot, labelKey: 'bots' },
  { to: '/live', icon: Activity, labelKey: 'liveTrading' },
  { to: '/analytics', icon: BarChart3, labelKey: 'analytics', disabled: true },
  { to: '/history', icon: History, labelKey: 'history', disabled: true },
  { to: '/settings', icon: Settings, labelKey: 'settings', disabled: true },
] as const

type NavItem = (typeof navItems)[number]

export function Sidebar() {
  const { t } = useAppPreferences()

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-purple shadow-lg shadow-accent-purple/30">
          <Zap size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground">ArbiDex</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted">{t('brand', 'subtitle')}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {navItems.map((item: NavItem) => {
          const { to, icon: Icon, labelKey } = item
          const disabled = 'disabled' in item && item.disabled

          return disabled ? (
            <div
              key={to}
              aria-disabled="true"
              title={t('nav', 'soon')}
              className="flex cursor-not-allowed select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted/40"
            >
              <Icon size={18} className="opacity-40" />
              {t('nav', labelKey)}
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted/30">
                {t('nav', 'soon')}
              </span>
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-accent-purple/15 text-accent-purple'
                    : 'text-muted hover:bg-white/5 hover:text-foreground',
                )
              }
            >
              <Icon size={18} />
              {t('nav', labelKey)}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
