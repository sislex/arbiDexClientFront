export type Theme = 'light' | 'dark'
export type Locale = 'ru' | 'en'

export interface UserProfile {
  name: string
}

export interface AppPreferences {
  theme: Theme
  locale: Locale
  user: UserProfile
}

export const PREFERENCES_STORAGE_KEY = 'arbidex-preferences'

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
  locale: 'ru',
  user: {
    name: 'John Doe',
  },
}

export function loadPreferences(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<AppPreferences>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      locale: parsed.locale === 'en' ? 'en' : 'ru',
      user: {
        name: parsed.user?.name?.trim() || DEFAULT_PREFERENCES.user.name,
      },
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(preferences: AppPreferences): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // ignore quota / private mode errors
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function applyLocale(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
}
