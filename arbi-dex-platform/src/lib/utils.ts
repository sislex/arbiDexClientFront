import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercent(value: number, signed = true): string {
  const prefix = signed && value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function getHeatmapColor(roi: number): string {
  if (roi >= 15) return 'bg-emerald-500/40 text-emerald-300'
  if (roi >= 8) return 'bg-emerald-500/25 text-emerald-400'
  if (roi >= 3) return 'bg-emerald-500/15 text-emerald-400/80'
  if (roi >= 0) return 'bg-slate-500/15 text-slate-400'
  if (roi >= -5) return 'bg-red-500/15 text-red-400/80'
  if (roi >= -10) return 'bg-red-500/25 text-red-400'
  return 'bg-red-500/40 text-red-300'
}
