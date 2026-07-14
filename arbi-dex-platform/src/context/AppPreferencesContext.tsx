import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { translations, type TranslationTree } from '../i18n/translations'
import {
  applyLocale,
  applyTheme,
  loadPreferences,
  savePreferences,
  type AppPreferences,
  type Locale,
  type Theme,
} from '../lib/preferencesStorage'

interface AppPreferencesContextValue {
  theme: Theme
  locale: Locale
  userName: string
  setTheme: (theme: Theme) => void
  setLocale: (locale: Locale) => void
  t: (section: keyof TranslationTree, key: string) => string
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null)

function syncDocument(preferences: AppPreferences) {
  applyTheme(preferences.theme)
  applyLocale(preferences.locale)
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences())

  useLayoutEffect(() => {
    syncDocument(preferences)
  }, [preferences])

  const persist = useCallback((next: AppPreferences) => {
    setPreferences(next)
    savePreferences(next)
    syncDocument(next)
  }, [])

  const setTheme = useCallback(
    (theme: Theme) => {
      persist({ ...preferences, theme })
    },
    [persist, preferences],
  )

  const setLocale = useCallback(
    (locale: Locale) => {
      persist({ ...preferences, locale })
    },
    [persist, preferences],
  )

  const t = useCallback(
    (section: keyof TranslationTree, key: string) => {
      const table = translations[preferences.locale][section] as Record<string, string>
      return table[key] ?? key
    },
    [preferences.locale],
  )

  const value = useMemo(
    () => ({
      theme: preferences.theme,
      locale: preferences.locale,
      userName: preferences.user.name,
      setTheme,
      setLocale,
      t,
    }),
    [preferences, setTheme, setLocale, t],
  )

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext)
  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider')
  }
  return context
}
