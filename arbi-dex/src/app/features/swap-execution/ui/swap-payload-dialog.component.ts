import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ExecuteSwapPayload } from '../utils/execute-swap-payload';

export interface SwapPayloadDialogData {
  title: string;
  payload: ExecuteSwapPayload;
  /** Успешный ответ от POST /api/swap-execution/execute */
  response?: unknown;
  /** Ошибка при вызове API (если своп не удался) */
  error?: unknown;
}

@Component({
  selector: 'app-swap-payload-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="swap-dialog">
      <h2 mat-dialog-title class="swap-dialog__title">
        <mat-icon>{{ data.error ? 'error_outline' : 'bolt' }}</mat-icon> {{ data.title }}
      </h2>
      <mat-dialog-content>
        <p class="swap-dialog__subtitle">POST /api/swap-execution/execute — тело запроса:</p>
        <pre class="swap-dialog__json">{{ requestJson }}</pre>

        <ng-container *ngIf="data.response !== undefined">
          <p class="swap-dialog__subtitle swap-dialog__subtitle--response">Ответ API:</p>
          <pre class="swap-dialog__json swap-dialog__json--response">{{ responseJson }}</pre>
        </ng-container>

        <ng-container *ngIf="data.error !== undefined">
          <p class="swap-dialog__subtitle swap-dialog__subtitle--error">Ошибка:</p>
          <pre class="swap-dialog__json swap-dialog__json--error">{{ errorJson }}</pre>
        </ng-container>

        <span *ngIf="copied" class="swap-dialog__copied">
          <mat-icon>check</mat-icon> Скопировано
        </span>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button (click)="copy()">
          <mat-icon>content_copy</mat-icon> Copy JSON
        </button>
        <button mat-flat-button color="primary" mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .swap-dialog {
      min-width: 520px;
      max-width: 700px;
      &__title {
        display: flex; align-items: center; gap: t.$spacing-xs;
        font-weight: t.$font-weight-semibold; margin-bottom: 0;
      }
      &__subtitle {
        color: var(--color-text-secondary);
        font-size: t.$font-size-sm;
        margin: t.$spacing-sm 0 t.$spacing-xs;
        &--response { color: t.$color-success; }
        &--error { color: t.$color-error; }
      }
      &__json {
        margin: 0;
        padding: t.$spacing-md;
        background: var(--color-surface-2);
        border: 1px solid var(--color-border);
        border-radius: t.$radius-sm;
        font-family: 'Roboto Mono', monospace;
        font-size: t.$font-size-xs;
        color: var(--color-text-primary);
        white-space: pre;
        overflow: auto;
        max-height: 35vh;
        &--response { border-color: t.$color-success; }
        &--error { border-color: t.$color-error; }
      }
      &__copied {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: t.$spacing-xs;
        color: t.$color-success;
        font-size: t.$font-size-xs;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }
  `],
})
export class SwapPayloadDialogComponent {
  readonly requestJson: string;
  readonly responseJson: string;
  readonly errorJson: string;
  copied = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: SwapPayloadDialogData) {
    this.requestJson = JSON.stringify(data.payload, null, 2);
    this.responseJson = data.response !== undefined ? JSON.stringify(data.response, null, 2) : '';
    this.errorJson = data.error !== undefined ? JSON.stringify(data.error, null, 2) : '';
  }

  copy(): void {
    const all = {
      request: data_to_obj(this.requestJson),
      ...(this.data.response !== undefined ? { response: data_to_obj(this.responseJson) } : {}),
      ...(this.data.error !== undefined ? { error: data_to_obj(this.errorJson) } : {}),
    };
    navigator.clipboard?.writeText(JSON.stringify(all, null, 2)).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}

function data_to_obj(json: string): unknown {
  try { return JSON.parse(json); } catch { return json; }
}
