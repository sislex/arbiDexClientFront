import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeStatus = 'active' | 'inactive' | 'error' | 'warning';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="status-badge" [class]="'status-badge--' + status">
      <span class="status-badge__dot"></span>
      {{ label || status }}
    </span>
  `,
  styles: [`
    @use 'sass:color';
    @use 'styles/tokens' as t;
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: t.$spacing-xxs;
      padding: 2px t.$spacing-xs;
      border-radius: t.$radius-full;
      font-size: t.$font-size-xs;
      font-weight: t.$font-weight-medium;
      text-transform: capitalize;
      &__dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      &--active  { background: t.$color-success-light; color: color.adjust(t.$color-success, $lightness: -10%);
                   .status-badge__dot { background: t.$color-success; } }
      &--inactive{ background: var(--color-surface-2); color: var(--color-text-secondary);
                   .status-badge__dot { background: var(--color-text-muted); } }
      &--error   { background: t.$color-error-light; color: color.adjust(t.$color-error, $lightness: -10%);
                   .status-badge__dot { background: t.$color-error; } }
      &--warning { background: t.$color-warning-light; color: color.adjust(t.$color-warning, $lightness: -10%);
                   .status-badge__dot { background: t.$color-warning; } }
    }
  `],
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: BadgeStatus;
  @Input() label?: string;
}

