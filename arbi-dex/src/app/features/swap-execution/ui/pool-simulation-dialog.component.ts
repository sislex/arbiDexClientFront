import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ExecuteSwapPayload } from '../utils/execute-swap-payload';

/** Результат симуляции одного пула (одной стороны bid/ask). */
export interface PoolSimResult {
  side: 'bid' | 'ask';
  pool?: { dex: string; version: string; poolAddress: string };
  payload?: ExecuteSwapPayload;
  /** Ответ preview (execute:false) от /api/swap-execution/execute */
  response?: unknown;
  /** Ошибка (пул не найден / preview-revert) */
  error?: unknown;
}

export interface PoolSimDialogData {
  title: string;
  pairId: string;
  /** 'USDC_TO_WETH' | 'WETH_TO_USDC' — определяет символы in/out */
  direction: string;
  results: PoolSimResult[];
}

interface Row {
  side: 'bid' | 'ask';
  keyLabel: string;
  poolLabel: string;
  poolAddress: string;
  ok: boolean;
  amountIn: string;
  amountOut: string;
  rate: string;
  errorMsg: string;
  best: boolean;
}

@Component({
  selector: 'app-pool-simulation-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="sim-dialog">
      <h2 mat-dialog-title class="sim-dialog__title">
        <mat-icon>science</mat-icon> {{ data.title }}
      </h2>
      <mat-dialog-content>
        <p class="sim-dialog__subtitle">
          Пара <b>{{ data.pairId }}</b> · направление <b>{{ data.direction }}</b> · режим симуляции (execute=false)
        </p>

        <div class="sim-grid">
          <div *ngFor="let row of rows"
               class="sim-card"
               [class.sim-card--best]="row.best"
               [class.sim-card--error]="!row.ok">
            <div class="sim-card__head">
              <span class="sim-card__key">{{ row.keyLabel }}</span>
              <span class="sim-card__badge" *ngIf="row.best">ЛУЧШАЯ ЦЕНА</span>
            </div>

            <div class="sim-card__pool">{{ row.poolLabel }}</div>
            <div class="sim-card__addr">{{ row.poolAddress }}</div>

            <ng-container *ngIf="row.ok; else errBlock">
              <div class="sim-card__row"><span>Отдаём</span><b>{{ row.amountIn }}</b></div>
              <div class="sim-card__row sim-card__row--out"><span>Получаем</span><b>{{ row.amountOut }}</b></div>
              <div class="sim-card__rate">{{ row.rate }}</div>
            </ng-container>
            <ng-template #errBlock>
              <div class="sim-card__err">{{ row.errorMsg }}</div>
            </ng-template>
          </div>
        </div>

        <p class="sim-dialog__hint" *ngIf="bestSide">
          → Лучшую цену для этого направления даёт <b>{{ bestSide }}Pool</b>.
          Этот ключ и нужно использовать.
        </p>

        <span *ngIf="copied" class="sim-dialog__copied"><mat-icon>check</mat-icon> Скопировано</span>
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
    .sim-dialog {
      min-width: 620px;
      max-width: 820px;
      &__title { display: flex; align-items: center; gap: t.$spacing-xs; font-weight: t.$font-weight-semibold; }
      &__subtitle { color: var(--color-text-secondary); font-size: t.$font-size-sm; margin: 0 0 t.$spacing-md; }
      &__hint {
        margin-top: t.$spacing-md; padding: t.$spacing-sm t.$spacing-md;
        background: rgba(14, 203, 129, 0.1); border: 1px solid #0ecb81;
        border-radius: t.$radius-sm; color: #0ecb81; font-size: t.$font-size-sm;
      }
      &__copied {
        display: inline-flex; align-items: center; gap: 4px; margin-top: t.$spacing-xs;
        color: t.$color-success; font-size: t.$font-size-xs;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }
    .sim-grid { display: grid; grid-template-columns: 1fr 1fr; gap: t.$spacing-md; }
    .sim-card {
      border: 1px solid var(--color-border); border-radius: t.$radius-sm;
      padding: t.$spacing-md; background: var(--color-surface-2);
      &--best { border-color: #0ecb81; box-shadow: 0 0 0 1px #0ecb81 inset; }
      &--error { border-color: t.$color-error; }
      &__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      &__key { font-weight: t.$font-weight-bold; font-size: t.$font-size-base; }
      &__badge {
        font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
        color: #0ecb81; border: 1px solid #0ecb81; border-radius: 10px; padding: 1px 8px;
      }
      &__pool { font-size: t.$font-size-sm; color: var(--color-text-secondary); text-transform: uppercase; }
      &__addr { font-family: monospace; font-size: 11px; color: var(--color-text-muted); margin-bottom: t.$spacing-sm; word-break: break-all; }
      &__row {
        display: flex; justify-content: space-between; font-size: t.$font-size-sm; padding: 2px 0;
        span { color: var(--color-text-muted); }
        &--out b { color: #0ecb81; }
      }
      &__rate { margin-top: 6px; font-size: t.$font-size-xs; color: var(--color-text-secondary); font-style: italic; }
      &__err { color: t.$color-error; font-size: t.$font-size-xs; white-space: pre-wrap; word-break: break-word; }
    }
  `],
})
export class PoolSimulationDialogComponent {
  rows: Row[] = [];
  bestSide: 'bid' | 'ask' | '' = '';
  copied = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: PoolSimDialogData) {
    const [inSym, outSym] = (data.direction ?? '').split('_TO_');

    const raw: (Row & { outNum: number })[] = data.results.map((res) => {
      const ok = res.response !== undefined && res.error === undefined;
      const step0 = ok ? this.extractStep(res.response) : null;
      const amtIn = step0 ? parseFloat(step0.amountInDecimal ?? '0') : 0;
      const amtOut = step0 ? parseFloat(step0.amountOutDecimal ?? '0') : 0;
      const rate = amtIn > 0 && amtOut > 0 ? amtOut / amtIn : 0;

      return {
        side: res.side,
        keyLabel: `${res.side}Pool`,
        poolLabel: res.pool ? `${res.pool.dex} ${res.pool.version}` : '— пул не получен —',
        poolAddress: res.pool?.poolAddress ?? '',
        ok,
        amountIn: `${this.fmt(amtIn)} ${inSym ?? ''}`,
        amountOut: `${this.fmt(amtOut)} ${outSym ?? ''}`,
        rate: rate > 0 ? `1 ${inSym} ≈ ${this.fmt(rate)} ${outSym}` : '',
        errorMsg: ok ? '' : this.extractError(res.error),
        best: false,
        outNum: ok ? amtOut : -1,
      };
    });

    const bestOut = Math.max(...raw.map((r) => r.outNum), 0);
    for (const r of raw) {
      if (r.outNum > 0 && r.outNum === bestOut) {
        r.best = true;
        this.bestSide = r.side;
      }
    }
    this.rows = raw.map(({ outNum, ...row }) => row);
  }

  private extractStep(response: unknown): { amountInDecimal?: string; amountOutDecimal?: string } | null {
    const r = response as { stepLogsNormalized?: Array<{ amountInDecimal?: string; amountOutDecimal?: string }> };
    return r?.stepLogsNormalized?.[0] ?? null;
  }

  private extractError(error: unknown): string {
    const e = error as { error?: { message?: string }; message?: string };
    return e?.error?.message ?? e?.message ?? JSON.stringify(error);
  }

  private fmt(n: number): string {
    if (!isFinite(n) || n === 0) return '0';
    if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
    return n.toLocaleString('en-US', { maximumFractionDigits: 10 });
  }

  copy(): void {
    navigator.clipboard?.writeText(JSON.stringify(this.data.results, null, 2)).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
