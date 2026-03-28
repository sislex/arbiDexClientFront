import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container" [class.page-container--full]="fullWidth">
      <ng-content />
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .page-container {
      max-width: t.$content-max-width;
      margin: 0 auto;
      padding: t.$content-padding;
      width: 100%;
      &--full { max-width: 100%; }
    }
    @media (max-width: #{t.$bp-sm}) {
      .page-container { padding: t.$spacing-md; }
    }
  `],
})
export class PageContainerComponent {
  @Input() fullWidth = false;
}

