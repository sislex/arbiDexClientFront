import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { combineLatest, map } from 'rxjs';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { LoadingStateComponent } from '../../shared/ui/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ArbiConfigsFacade } from '../../features/arbi-configs/facades/arbi-configs.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { ArbiConfig, Source, TradingPair } from '../../shared/models';

interface ConfigRow extends ArbiConfig {
  tradingLabel: string;
  referenceLabels: string[];
}

@Component({
  selector: 'app-arbi-configs-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    PageContainerComponent,
    PageHeaderComponent,
    LoadingStateComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Arbi Configs"
        subtitle="Arbitrage configurations for monitoring and backtesting">
        <div slot="actions">
          <button mat-flat-button color="primary" routerLink="/arbi-configs/new">
            <mat-icon>add</mat-icon> New Config
          </button>
        </div>
      </app-page-header>

      <app-loading-state *ngIf="loading$ | async" label="Loading configs…" />

      <app-empty-state
        *ngIf="(loading$ | async) === false && (rows$ | async)?.length === 0"
        icon="tune"
        title="No configs yet"
        description="Create your first arbitrage config to start monitoring price differences."
        actionLabel="Create Config"
        (action)="goToNew()">
      </app-empty-state>

      <div class="configs-grid" *ngIf="(loading$ | async) === false && ((rows$ | async)?.length ?? 0) > 0">
        <div
          *ngFor="let row of rows$ | async"
          class="config-card"
          (click)="goToDetail(row.id)">
          <div class="config-card__header">
            <mat-icon class="config-card__icon">tune</mat-icon>
            <span class="config-card__name">{{ row.name }}</span>
          </div>
          <div class="config-card__body">
            <div class="config-card__field">
              <span class="config-card__label">Trading:</span>
              <span class="config-card__value">{{ row.tradingLabel }}</span>
            </div>
            <div class="config-card__field">
              <span class="config-card__label">Reference:</span>
              <div class="config-card__chips">
                <span class="chip" *ngFor="let ref of row.referenceLabels">{{ ref }}</span>
              </div>
            </div>
            <div class="config-card__row">
              <span class="config-card__meta">{{ row.profitAsset }}</span>
              <span class="config-card__meta">Slip: {{ row.slippage * 100 | number:'1.1-2' }}%</span>
              <span class="config-card__meta">Bal: {{ row.initialBalance }}</span>
            </div>
          </div>
        </div>
      </div>
    </app-page-container>
  `,
  styles: [`
    @use 'styles/tokens' as t;

    .configs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: t.$spacing-md;
    }

    .config-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: t.$radius-md;
      padding: t.$spacing-md;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;

      &:hover {
        border-color: var(--color-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      &__header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      &__icon {
        color: var(--color-primary);
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      &__name {
        font-size: t.$font-size-md;
        font-weight: t.$font-weight-bold;
        color: var(--color-text-primary);
      }

      &__body {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      &__field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      &__label {
        font-size: t.$font-size-xs;
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      &__value {
        font-size: t.$font-size-sm;
        color: var(--color-text-primary);
      }

      &__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      &__row {
        display: flex;
        gap: 12px;
        margin-top: 4px;
      }

      &__meta {
        font-size: t.$font-size-xs;
        color: var(--color-text-muted);
        background: var(--color-background);
        padding: 2px 8px;
        border-radius: t.$radius-sm;
      }
    }

    .chip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--color-background);
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }
  `],
})
export class ArbiConfigsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly configsFacade = inject(ArbiConfigsFacade);
  private readonly catalogFacade = inject(CatalogFacade);

  readonly loading$ = this.configsFacade.loading$;

  readonly rows$ = combineLatest([
    this.configsFacade.all$,
    this.catalogFacade.sources$,
    this.catalogFacade.pairs$,
  ]).pipe(
    map(([configs, sources, pairs]) => {
      const sourceMap = new Map(sources.map((s: Source) => [s.id, s]));
      const pairMap = new Map(pairs.map((p: TradingPair) => [p.id, p]));

      return configs.map((c) => ({
        ...c,
        tradingLabel: this.makeLabel(c.tradingSourceId, c.tradingPairId, sourceMap, pairMap),
        referenceLabels: c.sources.map((s) =>
          this.makeLabel(s.sourceId, s.pairId, sourceMap, pairMap),
        ),
      }));
    }),
  );

  ngOnInit(): void {
    this.configsFacade.load();
    this.catalogFacade.loadAll();
  }

  goToNew(): void {
    this.router.navigate(['/arbi-configs/new']);
  }

  goToDetail(id: string): void {
    this.router.navigate(['/arbi-configs', id]);
  }

  private makeLabel(
    sourceId?: string,
    pairId?: string,
    sourceMap?: Map<string, Source>,
    pairMap?: Map<string, TradingPair>,
  ): string {
    if (!sourceId || !pairId) return 'Unknown';
    const src = sourceMap?.get(sourceId)?.displayName ?? sourceId;
    const pair = pairMap?.get(pairId)?.displayName ?? pairId;
    return `${src} — ${pair}`;
  }
}

