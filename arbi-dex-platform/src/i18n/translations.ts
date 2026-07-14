import type { Locale } from '../lib/preferencesStorage'

export const translations = {
  ru: {
    nav: {
      dashboard: 'Dashboard',
      tradingPairs: 'Trading Pairs',
      strategies: 'Strategies',
      bots: 'Bots',
      liveTrading: 'Live Trading',
      analytics: 'Analytics',
      history: 'History',
      settings: 'Settings',
      soon: 'Soon',
    },
    userMenu: {
      administrator: 'Администратор',
      theme: 'TEMA',
      themeLight: 'Светлая',
      themeDark: 'Тёмная',
      language: 'ЯЗЫК',
      english: 'English',
      russian: 'Русский',
      logout: 'Выйти',
    },
    brand: {
      subtitle: 'Trading Platform',
    },
  },
  en: {
    nav: {
      dashboard: 'Dashboard',
      tradingPairs: 'Trading Pairs',
      strategies: 'Strategies',
      bots: 'Bots',
      liveTrading: 'Live Trading',
      analytics: 'Analytics',
      history: 'History',
      settings: 'Settings',
      soon: 'Soon',
    },
    userMenu: {
      administrator: 'Administrator',
      theme: 'THEME',
      themeLight: 'Light',
      themeDark: 'Dark',
      language: 'LANGUAGE',
      english: 'English',
      russian: 'Russian',
      logout: 'Log out',
    },
    brand: {
      subtitle: 'Trading Platform',
    },
  },
} as const satisfies Record<Locale, Record<string, Record<string, string>>>

export type TranslationTree = typeof translations.ru
