import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="page-header__title">{{ title }}</h1>
        <p *ngIf="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
      </div>
      <div class="page-header__actions">
        <ng-content select="[slot=actions]" />
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: t.$spacing-md;
      margin-bottom: t.$spacing-xl;
      flex-wrap: wrap;
      &__title {
        margin: 0;
        font-size: t.$font-size-xl;
        font-weight: t.$font-weight-semibold;
        color: var(--color-text-primary);
        line-height: t.$line-height-tight;
      }
      &__subtitle {
        margin: t.$spacing-xs 0 0;
        font-size: t.$font-size-base;
        color: var(--color-text-secondary);
      }
      &__actions {
        display: flex;
        align-items: center;
        gap: t.$spacing-sm;
        flex-shrink: 0;
      }
    }
  `],
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}

