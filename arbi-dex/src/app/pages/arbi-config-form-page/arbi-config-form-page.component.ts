import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subscription as RxSubscription, combineLatest } from 'rxjs';
import { take, filter, map } from 'rxjs/operators';
import { PageContainerComponent } from '../../shared/ui/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ContentCardComponent } from '../../shared/ui/content-card/content-card.component';
import { ArbiConfigsFacade } from '../../features/arbi-configs/facades/arbi-configs.facade';
import { SubscriptionsFacade } from '../../features/subscriptions/facades/subscriptions.facade';
import { CatalogFacade } from '../../features/catalog/facades/catalog.facade';
import { Subscription, Source, TradingPair } from '../../shared/models';

interface SubOption {
  id: string;
  label: string;
  sourceId: string;
  pairId: string;
}

@Component({
  selector: 'app-arbi-config-form-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PageContainerComponent,
    PageHeaderComponent,
    ContentCardComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        [title]="isEdit ? 'Edit Config' : 'New Arbi Config'"
        subtitle="Configure arbitrage monitoring from your subscriptions">
        <div slot="actions">
          <button mat-stroked-button routerLink="/arbi-configs">
            <mat-icon>arrow_back</mat-icon> Back
          </button>
        </div>
      </app-page-header>

      <app-content-card title="Section 1 — Data Sources" [compact]="true">
        <div class="form-grid">
          <!-- Name -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Config Name</mat-label>
            <input matInput [(ngModel)]="name" placeholder="e.g. ETH Arbi CEX→DEX" />
          </mat-form-field>

          <!-- Reference Sources (multi-select) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reference Sources (CEX)</mat-label>
            <mat-select [(ngModel)]="referenceIds" multiple>
              <mat-option *ngFor="let opt of subOptions" [value]="opt.id">
                {{ opt.label }}
              </mat-option>
            </mat-select>
            <mat-hint>Sources to calculate average price signal</mat-hint>
          </mat-form-field>

          <!-- Trading Source (single select) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Trading Source (DEX)</mat-label>
            <mat-select [(ngModel)]="tradingId">
              <mat-option *ngFor="let opt of subOptions" [value]="opt.id">
                {{ opt.label }}
              </mat-option>
            </mat-select>
            <mat-hint>Exchange where trades will be executed</mat-hint>
          </mat-form-field>

          <div class="row-fields">
            <!-- Profit Asset -->
            <mat-form-field appearance="outline">
              <mat-label>Profit Asset</mat-label>
              <mat-select [(ngModel)]="profitAsset">
                <mat-option value="USDC">USDC</mat-option>
                <mat-option value="USDT">USDT</mat-option>
                <mat-option value="WETH">WETH</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Slippage -->
            <mat-form-field appearance="outline">
              <mat-label>Slippage %</mat-label>
              <input matInput type="number" [(ngModel)]="slippagePct" min="0" max="100" step="0.1" />
            </mat-form-field>

            <!-- Initial Balance -->
            <mat-form-field appearance="outline">
              <mat-label>Initial Balance</mat-label>
              <input matInput type="number" [(ngModel)]="initialBalance" min="0" step="10" />
            </mat-form-field>
          </div>
        </div>
      </app-content-card>

      <!-- Validation -->
      <div *ngIf="validationError" class="error-msg">
        <mat-icon>error_outline</mat-icon> {{ validationError }}
      </div>

      <div class="actions-row">
        <button
          mat-flat-button
          color="primary"
          [disabled]="creating$ | async"
          (click)="onSubmit()">
          <mat-icon>{{ isEdit ? 'save' : 'add' }}</mat-icon>
          {{ isEdit ? 'Save' : 'Create Config' }}
        </button>
      </div>
    </app-page-container>
  `,
  styles: [`
    @use 'styles/tokens' as t;

    .form-grid {
      display: flex;
      flex-direction: column;
      gap: t.$spacing-sm;
    }

    .full-width {
      width: 100%;
    }

    .row-fields {
      display: flex;
      gap: t.$spacing-md;
      flex-wrap: wrap;

      mat-form-field {
        flex: 1;
        min-width: 160px;
      }
    }

    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      color: var(--color-danger, #ef4444);
      background: rgba(239, 68, 68, 0.08);
      border-radius: t.$radius-sm;
      margin-top: t.$spacing-sm;
    }

    .actions-row {
      display: flex;
      justify-content: flex-end;
      margin-top: t.$spacing-md;
    }
  `],
})
export class ArbiConfigFormPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly configsFacade = inject(ArbiConfigsFacade);
  private readonly subsFacade = inject(SubscriptionsFacade);
  private readonly catalogFacade = inject(CatalogFacade);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly creating$ = this.configsFacade.creating$;

  isEdit = false;
  editId = '';

  // Form fields
  name = '';
  referenceIds: string[] = [];
  tradingId = '';
  profitAsset = 'USDC';
  slippagePct = 1; // in percent
  initialBalance = 100;

  subOptions: SubOption[] = [];
  validationError = '';

  private rxSubs: RxSubscription[] = [];

  ngOnInit(): void {
    this.subsFacade.load();
    this.catalogFacade.loadAll();

    const paramId = this.route.snapshot.paramMap.get('id');
    if (paramId) {
      this.isEdit = true;
      this.editId = paramId;
      this.configsFacade.loadOne(paramId);
    }

    // Build subscription options
    const sub = combineLatest([
      this.subsFacade.active$,
      this.catalogFacade.sources$,
      this.catalogFacade.pairs$,
    ]).pipe(
      filter(([subs, sources, pairs]) => subs.length > 0 && sources.length > 0),
    ).subscribe(([subs, sources, pairs]) => {
      const sourceMap = new Map(sources.map((s: Source) => [s.id, s]));
      const pairMap = new Map(pairs.map((p: TradingPair) => [p.id, p]));

      this.subOptions = subs.map((s) => ({
        id: s.id,
        label: `${sourceMap.get(s.sourceId)?.displayName ?? s.sourceId} — ${pairMap.get(s.pairId)?.displayName ?? s.pairId}`,
        sourceId: s.sourceId,
        pairId: s.pairId,
      }));

      // If editing, populate form
      if (this.isEdit) {
        this.populateEditForm();
      }

      this.cdr.markForCheck();
    });
    this.rxSubs.push(sub);
  }

  ngOnDestroy(): void {
    this.rxSubs.forEach((s) => s.unsubscribe());
  }

  onSubmit(): void {
    this.validationError = '';

    if (!this.name.trim()) {
      this.validationError = 'Please enter a config name';
      return;
    }
    if (this.referenceIds.length === 0) {
      this.validationError = 'Please select at least one reference source';
      return;
    }
    if (!this.tradingId) {
      this.validationError = 'Please select a trading source';
      return;
    }
    if (this.referenceIds.includes(this.tradingId)) {
      this.validationError = 'Trading source must not be in reference sources';
      return;
    }

    const payload = {
      name: this.name.trim(),
      tradingSubscriptionId: this.tradingId,
      referenceSubscriptionIds: this.referenceIds,
      profitAsset: this.profitAsset,
      slippage: this.slippagePct / 100,
      initialBalance: this.initialBalance,
    };

    if (this.isEdit) {
      this.configsFacade.update(this.editId, payload);
    } else {
      this.configsFacade.create(payload);
    }
  }

  private populateEditForm(): void {
    const sub = this.configsFacade.selectById(this.editId)
      .pipe(filter((c) => !!c), take(1))
      .subscribe((config) => {
        if (!config) return;
        this.name = config.name;
        this.tradingId = config.tradingSubscriptionId;
        this.referenceIds = config.referenceSubscriptionIds;
        this.profitAsset = config.profitAsset;
        this.slippagePct = config.slippage * 100;
        this.initialBalance = config.initialBalance;
        this.cdr.markForCheck();
      });
    this.rxSubs.push(sub);
  }
}

