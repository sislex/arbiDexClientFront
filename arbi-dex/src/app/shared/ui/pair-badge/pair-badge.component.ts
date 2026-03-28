import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pair-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="pair-badge">
      <span class="pair-badge__base">{{ base }}</span>
      <span class="pair-badge__sep">/</span>
      <span class="pair-badge__quote">{{ quote }}</span>
    </span>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .pair-badge {
      display: inline-flex;
      align-items: center;
      gap: 1px;
      padding: 3px t.$spacing-xs;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-full;
      font-size: t.$font-size-xs;
      font-weight: t.$font-weight-semibold;
      font-family: 'Roboto Mono', monospace;
      &__base  { color: var(--color-text-primary); }
      &__sep   { color: var(--color-text-muted); }
      &__quote { color: var(--color-text-secondary); }
    }
  `],
})
export class PairBadgeComponent {
  @Input({ required: true }) base!: string;
  @Input({ required: true }) quote!: string;
}

