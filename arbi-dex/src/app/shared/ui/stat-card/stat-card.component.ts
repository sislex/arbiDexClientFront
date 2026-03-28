import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="stat-card">
      <div class="stat-card__icon-wrap" [class]="'stat-card__icon-wrap--' + color">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__label">{{ label }}</span>
        <span *ngIf="!loading; else loadingTpl" class="stat-card__value">{{ value }}</span>
        <ng-template #loadingTpl>
          <span class="stat-card__value stat-card__value--loading">—</span>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .stat-card {
      display: flex;
      align-items: center;
      gap: t.$spacing-md;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-md;
      padding: t.$spacing-lg;
      box-shadow: t.$shadow-xs;
      &__icon-wrap {
        width: 48px; height: 48px;
        border-radius: t.$radius-sm;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
        &--blue    { background: t.$color-cex-light;      color: t.$color-primary; }
        &--purple  { background: t.$color-dex-light;      color: t.$color-secondary; }
        &--green   { background: t.$color-success-light;  color: t.$color-success; }
        &--orange  { background: t.$color-warning-light;  color: t.$color-warning; }
      }
      &__body { display: flex; flex-direction: column; gap: 2px; }
      &__label {
        font-size: t.$font-size-sm;
        color: var(--color-text-secondary);
        font-weight: t.$font-weight-medium;
      }
      &__value {
        font-size: t.$font-size-xl;
        font-weight: t.$font-weight-bold;
        color: var(--color-text-primary);
        &--loading { color: var(--color-text-muted); }
      }
    }
  `],
})
export class StatCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() icon = 'bar_chart';
  @Input() color: 'blue' | 'purple' | 'green' | 'orange' = 'blue';
  @Input() loading = false;
}

