import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ExecuteSwapPayload } from '../utils/execute-swap-payload';

/**
 * Сервис вызова реального on-chain свопа через backend execute API.
 */
@Injectable({ providedIn: 'root' })
export class SwapExecutionService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /** Отправляет запрос на исполнение свопа и возвращает подробный ответ от API. */
  execute(payload: ExecuteSwapPayload): Observable<unknown> {
    return this.http.post<unknown>(`${this.apiBaseUrl}/swap-execution/execute`, payload);
  }
}
