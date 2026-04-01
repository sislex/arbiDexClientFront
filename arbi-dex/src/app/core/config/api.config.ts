import { InjectionToken } from '@angular/core';

/** Базовый URL бэкенда (с учётом global prefix /api) */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3003/api',
});

