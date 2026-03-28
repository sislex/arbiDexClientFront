import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SourceType } from '../../models';

@Component({
  selector: 'app-source-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="source-badge" [class]="'source-badge--' + type">
      <span class="source-badge__icon">{{ type === 'dex' ? '⬡' : '⬢' }}</span>
      {{ displayName }}
    </span>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .source-badge {
      display: inline-flex;
      align-items: center;
      gap: t.$spacing-xxs;
      padding: 3px t.$spacing-xs;
      border-radius: t.$radius-full;
      font-size: t.$font-size-xs;
      font-weight: t.$font-weight-medium;
      &--dex {
        background: t.$color-dex-light;
        color: t.$color-dex;
      }
      &--cex {
        background: t.$color-cex-light;
        color: t.$color-cex;
      }
      &__icon { font-size: 10px; }
    }
  `],
})
export class SourceBadgeComponent {
  @Input({ required: true }) type!: SourceType;
  @Input({ required: true }) displayName!: string;
}

