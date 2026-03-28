import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LayoutFacade } from './features/layout/facades/layout.facade';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `<router-outlet />`,
  styles: [`:host { display: block; height: 100vh; overflow: hidden; }`],
})
export class AppComponent implements OnInit {
  private readonly layout = inject(LayoutFacade);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.layout.theme$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
      });
  }
}


