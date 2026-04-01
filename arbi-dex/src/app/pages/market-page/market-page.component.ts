import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { combineLatest, map } from 'rxjs';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { Source, TradingPair } from '../../shared/models';
import { FilterBarState } from '../../shared/ui/filter-bar/filter-bar.component';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { PageSectionComponent } from '../../shared/ui/page-section/page-section.component';
import { FilterBarComponent } from '../../shared/ui/filter-bar/filter-bar.component';
import { SourceBadgeComponent } from '../../shared/ui/source-badge/source-badge.component';
import { PairBadgeComponent } from '../../shared/ui/pair-badge/pair-badge.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state/loading-state.component';

@Component({
  selector: 'app-market-page',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatSnackBarModule,
    PageContainerComponent, PageHeaderComponent, PageSectionComponent,
    FilterBarComponent, SourceBadgeComponent, PairBadgeComponent, LoadingStateComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header title="Market Catalog" subtitle="Select a source and a pair to create a subscription" />

      <app-filter-bar
        [sourceTypeOptions]="[{value:'dex',label:'DEX'},{value:'cex',label:'CEX'}]"
        (filterChange)="onFilter($event)" />

      <div class="catalog-grid">
        <!-- Sources -->
        <app-page-section title="Sources">
          <app-loading-state *ngIf="loading$ | async" size="sm" label="Loading sources…" />
          <div *ngIf="!(loading$ | async)" class="card-grid">
            <div
              *ngFor="let src of filteredSources"
              class="catalog-card"
              [class.catalog-card--selected]="selectedSourceId === src.id"
              (click)="selectSource(src)">
              <app-source-badge [type]="src.type" [displayName]="src.displayName" />
              <span class="catalog-card__name">{{ src.displayName }}</span>
              <span class="catalog-card__type">{{ src.type | uppercase }}</span>
            </div>
          </div>
        </app-page-section>

        <!-- Pairs (показываем только когда выбран source) -->
        <app-page-section *ngIf="selectedSourceId" title="Trading Pairs for {{ selectedSourceLabel }}">
          <app-loading-state *ngIf="pairsLoading" size="sm" label="Loading pairs…" />
          <div *ngIf="!pairsLoading" class="card-grid">
            <div
              *ngFor="let pair of filteredPairs"
              class="catalog-card"
              [class.catalog-card--selected]="selectedPairId === pair.id"
              (click)="selectPair(pair)">
              <app-pair-badge [base]="pair.base" [quote]="pair.quote" />
              <span class="catalog-card__name">{{ pair.displayName }}</span>
            </div>
          </div>
        </app-page-section>
      </div>

      <!-- Add subscription bar -->
      <div *ngIf="selectedSourceId && selectedPairId" class="add-bar">
        <span class="add-bar__label">
          Add subscription:
          <strong>{{ selectedSourceLabel }}</strong> × <strong>{{ selectedPairLabel }}</strong>
        </span>
        <button mat-flat-button color="primary" (click)="addSubscription()">
          <mat-icon>add</mat-icon> Add Subscription
        </button>
      </div>
    </app-page-container>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .catalog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: t.$spacing-lg;
      @media (max-width: #{t.$bp-md}) { grid-template-columns: 1fr; } }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: t.$spacing-sm; }
    .catalog-card {
      display: flex; flex-direction: column; gap: t.$spacing-xs;
      padding: t.$spacing-md;
      background: var(--color-surface);
      border: 2px solid var(--color-border);
      border-radius: t.$radius-md;
      cursor: pointer;
      transition: all t.$transition-fast;
      &:hover { border-color: t.$color-primary; box-shadow: t.$shadow-sm; }
      &--selected { border-color: t.$color-primary; background: t.$color-info-light; }
      &__name { font-weight: t.$font-weight-semibold; font-size: t.$font-size-base; color: var(--color-text-primary); }
      &__type { font-size: t.$font-size-xs; color: var(--color-text-muted); font-weight: t.$font-weight-medium; }
    }
    .add-bar {
      position: sticky; bottom: t.$spacing-md;
      display: flex; align-items: center; justify-content: space-between;
      padding: t.$spacing-md t.$spacing-lg;
      background: var(--color-surface);
      border: 1px solid t.$color-primary;
      border-radius: t.$radius-md;
      box-shadow: t.$shadow-md;
      gap: t.$spacing-md;
      &__label { font-size: t.$font-size-base; color: var(--color-text-primary); }
    }
  `],
})
export class MarketPageComponent implements OnInit {
  private readonly catalog = inject(CatalogFacade);
  private readonly subsFacade = inject(SubscriptionsFacade);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading$ = this.catalog.loading$;

  filteredSources: Source[] = [];
  filteredPairs: TradingPair[] = [];
  pairsLoading = false;
  selectedSourceId: string | null = null;
  selectedPairId: string | null = null;
  selectedSourceLabel = '';
  selectedPairLabel = '';

  private allSources: Source[] = [];
  private allPairs: TradingPair[] = [];
  private currentFilter: FilterBarState = { search: '', sourceType: '' };

  ngOnInit(): void {
    this.catalog.loadSources();
    this.catalog.sources$.subscribe((s) => { this.allSources = s; this.applyFilter(); });
    this.catalog.pairs$.subscribe((p) => {
      this.allPairs = p;
      this.pairsLoading = false;
      this.applyFilter();
    });
  }

  onFilter(f: FilterBarState): void {
    this.currentFilter = f;
    this.applyFilter();
  }

  private applyFilter(): void {
    const { search, sourceType } = this.currentFilter;
    const q = search.toLowerCase();
    this.filteredSources = this.allSources.filter(
      (s) =>
        (!q || s.displayName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) &&
        (!sourceType || s.type === sourceType),
    );
    this.filteredPairs = this.allPairs.filter(
      (p) => !q || p.displayName.toLowerCase().includes(q),
    );
  }

  selectSource(src: Source): void {
    this.selectedSourceId = src.id;
    this.selectedSourceLabel = src.displayName;
    this.selectedPairId = null;
    this.selectedPairLabel = '';
    this.pairsLoading = true;
    this.filteredPairs = [];
    this.catalog.loadPairsBySource(src.id);
  }

  selectPair(pair: TradingPair): void {
    this.selectedPairId = pair.id;
    this.selectedPairLabel = pair.displayName;
  }

  addSubscription(): void {
    if (!this.selectedSourceId || !this.selectedPairId) return;
    this.subsFacade.add(this.selectedSourceId, this.selectedPairId);
    this.snackBar.open(`Subscription added: ${this.selectedSourceLabel} × ${this.selectedPairLabel}`, 'OK', { duration: 3000 });
    this.selectedSourceId = null;
    this.selectedPairId = null;
  }
}

