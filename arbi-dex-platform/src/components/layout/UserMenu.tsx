import { useEffect, useState, type RefObject } from 'react'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useAppPreferences } from '../../context/AppPreferencesContext'
import { useAuth } from '../../context/AuthContext'
import { shortAddress } from '../../lib/shortAddress'
import { cn } from '../../lib/utils'

function FlagUs() {
  return (
    <svg viewBox="0 0 24 16" className="h-3.5 w-5 shrink-0 rounded-[2px] border border-black/10" aria-hidden>
      <rect width="24" height="16" fill="#b22234" />
      <rect y="2" width="24" height="2" fill="#fff" />
      <rect y="6" width="24" height="2" fill="#fff" />
      <rect y="10" width="24" height="2" fill="#fff" />
      <rect y="14" width="24" height="2" fill="#fff" />
      <rect width="10" height="8" fill="#3c3b6e" />
    </svg>
  )
}

function FlagRu() {
  return (
    <svg viewBox="0 0 24 16" className="h-3.5 w-5 shrink-0 rounded-[2px] border border-black/10" aria-hidden>
      <rect width="24" height="5.33" fill="#fff" />
      <rect y="5.33" width="24" height="5.34" fill="#0039a6" />
      <rect y="10.67" width="24" height="5.33" fill="#d52b1e" />
    </svg>
  )
}

interface UserMenuProps {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
}

export function UserMenu({ open, onClose, anchorRef }: UserMenuProps) {
  const { theme, locale, userName, setTheme, setLocale, t } = useAppPreferences()
  const { walletAddress, walletProvider, logout } = useAuth()
  const [mounted, setMounted] = useState(open)
  const displayName = walletAddress ? shortAddress(walletAddress) : userName
  const roleLabel = walletProvider ?? t('userMenu', 'administrator')

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (anchorRef.current?.contains(event.target as Node)) return
      onClose()
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose, anchorRef])

  if (!mounted) return null

  return (
    <div
      className={cn(
        'absolute right-0 top-[calc(100%+10px)] z-50 w-[280px] origin-top-right rounded-2xl border border-border bg-card shadow-2xl transition-all duration-150',
        open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
      )}
    >
      <div className="px-5 py-4 border-b border-border">
        <p className="text-base font-semibold text-foreground">{displayName}</p>
        <p className="text-sm font-medium text-accent-gold mt-0.5">{roleLabel}</p>
      </div>

      <div className="px-5 py-4 border-b border-border space-y-2.5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
          {t('userMenu', 'theme')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
              theme === 'light'
                ? 'border-accent-gold/50 bg-menu-active text-accent-gold'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            <Sun size={15} />
            {t('userMenu', 'themeLight')}
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
              theme === 'dark'
                ? 'border-accent-gold/50 bg-menu-active text-accent-gold'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            <Moon size={15} />
            {t('userMenu', 'themeDark')}
          </button>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-border space-y-2.5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
          {t('userMenu', 'language')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
              locale === 'en'
                ? 'border-accent-gold/50 bg-menu-active text-accent-gold'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            <FlagUs />
            {t('userMenu', 'english')}
          </button>
          <button
            type="button"
            onClick={() => setLocale('ru')}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
              locale === 'ru'
                ? 'border-accent-gold/50 bg-menu-active text-accent-gold'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            <FlagRu />
            {t('userMenu', 'russian')}
          </button>
        </div>
      </div>

      <div className="p-4">
        <button
          type="button"
          onClick={() => {
            onClose()
            logout()
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-medium text-error transition-colors hover:bg-error/15"
        >
          <LogOut size={16} />
          {t('userMenu', 'logout')}
        </button>
      </div>
    </div>
  )
}
