import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="empty-state">
      <mat-icon class="empty-state__icon">{{ icon }}</mat-icon>
      <h3 class="empty-state__title">{{ title }}</h3>
      <p *ngIf="description" class="empty-state__desc">{{ description }}</p>
      <button
        *ngIf="actionLabel"
        mat-flat-button
        color="primary"
        class="empty-state__action"
        (click)="action.emit()">
        {{ actionLabel }}
      </button>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: t.$spacing-xxl t.$spacing-lg;
      text-align: center;
      gap: t.$spacing-sm;
      &__icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--color-text-muted);
      }
      &__title {
        margin: 0;
        font-size: t.$font-size-md;
        font-weight: t.$font-weight-medium;
        color: var(--color-text-primary);
      }
      &__desc {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: t.$font-size-base;
      }
      &__action { margin-top: t.$spacing-sm; }
    }
  `],
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() actionLabel?: string;
  @Output() action = new EventEmitter<void>();
}

