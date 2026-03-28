import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-content-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content-card" [class.content-card--elevated]="elevated" [class.content-card--compact]="compact">
      <div *ngIf="title" class="content-card__header">
        <span class="content-card__title">{{ title }}</span>
        <ng-content select="[slot=header-actions]" />
      </div>
      <div class="content-card__body">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .content-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-md;
      padding: t.$spacing-lg;
      box-shadow: t.$shadow-xs;
      &--elevated { box-shadow: t.$shadow-md; }
      &--compact { padding: t.$spacing-md; }
      &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: t.$spacing-md;
        padding-bottom: t.$spacing-md;
        border-bottom: 1px solid var(--color-border);
      }
      &__title {
        font-size: t.$font-size-base;
        font-weight: t.$font-weight-semibold;
        color: var(--color-text-primary);
      }
    }
  `],
})
export class ContentCardComponent {
  @Input() title?: string;
  @Input() elevated = false;
  @Input() compact = false;
}

