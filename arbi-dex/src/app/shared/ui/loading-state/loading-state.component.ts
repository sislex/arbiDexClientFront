import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="loading-state">
      <mat-spinner [diameter]="size === 'sm' ? 24 : 40" />
      <span *ngIf="label" class="loading-state__label">{{ label }}</span>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: t.$spacing-xxl t.$spacing-lg;
      gap: t.$spacing-md;
      &__label {
        color: var(--color-text-secondary);
        font-size: t.$font-size-base;
      }
    }
  `],
})
export class LoadingStateComponent {
  @Input() label = 'Loading…';
  @Input() size: 'sm' | 'md' = 'md';
}

