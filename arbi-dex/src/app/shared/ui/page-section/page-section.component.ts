import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-section">
      <div *ngIf="title" class="page-section__header">
        <h2 class="page-section__title">{{ title }}</h2>
        <ng-content select="[slot=header-actions]" />
      </div>
      <div class="page-section__body">
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .page-section {
      margin-bottom: t.$spacing-xl;
      &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: t.$spacing-md;
      }
      &__title {
        margin: 0;
        font-size: t.$font-size-md;
        font-weight: t.$font-weight-semibold;
        color: var(--color-text-primary);
      }
    }
  `],
})
export class PageSectionComponent {
  @Input() title?: string;
}

