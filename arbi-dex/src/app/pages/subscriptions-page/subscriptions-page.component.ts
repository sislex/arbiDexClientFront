import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { SubscriptionsTableComponent } from '../../shared/ui/subscriptions-table/subscriptions-table.component';

@Component({
  selector: 'app-subscriptions-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatButtonModule, MatIconModule,
    PageContainerComponent, PageHeaderComponent, SubscriptionsTableComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header title="Subscriptions" subtitle="Manage your active market subscriptions">
        <div slot="actions">
          <button mat-flat-button color="primary" routerLink="/market">
            <mat-icon>add</mat-icon> Add Subscription
          </button>
        </div>
      </app-page-header>

      <app-subscriptions-table
        [subscriptions]="(saved$ | async) ?? []"
        [sources]="(sources$ | async) ?? []"
        [pairs]="(pairs$ | async) ?? []"
        [loading]="(loading$ | async) ?? false"
        (remove)="onRemove($event)"
        (toggle)="onToggle($event)"
        (view)="onView($event)"
        (addClicked)="onAddClicked()" />
    </app-page-container>
  `,
})
export class SubscriptionsPageComponent implements OnInit {
  private readonly subs = inject(SubscriptionsFacade);
  private readonly catalog = inject(CatalogFacade);
  private readonly router = inject(Router);

  readonly saved$ = this.subs.saved$;
  readonly loading$ = this.subs.loading$;
  readonly sources$ = this.catalog.sources$;
  readonly pairs$ = this.catalog.pairs$;

  ngOnInit(): void {
    this.subs.load();
    this.catalog.loadAll();
  }

  onRemove(id: string): void { this.subs.remove(id); }
  onToggle(id: string): void { this.subs.toggle(id); }
  onView(id: string): void   { this.router.navigate(['/subscriptions', id]); }
  onAddClicked(): void {}
}

