import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { map } from 'rxjs/operators';
import { Quote, Source, TradingPair } from '../../models';
import { LoadingStateComponent } from '../loading-state/loading-state.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { formatPrice, formatSpreadPct, formatTimestamp } from '../../utils/format.utils';
import { LayoutFacade } from '../../../features/layout/facades/layout.facade';
import { AG_THEME_LIGHT, AG_THEME_DARK } from '../../utils/ag-grid-themes';

@Component({
  selector: 'app-quotes-table',
  standalone: true,
  imports: [CommonModule, AsyncPipe, AgGridAngular, LoadingStateComponent, EmptyStateComponent],
  template: `
    <div class="quotes-table">
      <app-loading-state *ngIf="loading" label="Loading quotes…" />
      <app-empty-state
        *ngIf="!loading && rows.length === 0"
        icon="show_chart"
        title="No quotes available"
        description="Subscribe to sources and pairs to see live quotes" />
      <ag-grid-angular
        *ngIf="!loading && rows.length > 0"
        [theme]="(agTheme$ | async) ?? lightTheme"
        [rowData]="rows"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [domLayout]="'autoHeight'"
        [animateRows]="true"
        (gridReady)="onGridReady($event)" />
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .quotes-table { width: 100%; }
    ag-grid-angular { width: 100%; border-radius: t.$radius-md; overflow: hidden; }
  `],
})
export class QuotesTableComponent implements OnChanges {
  @Input() quotes: Quote[] = [];
  @Input() sources: Source[] = [];
  @Input() pairs: TradingPair[] = [];
  @Input() loading = false;

  rows: Quote[] = [];

  private readonly layout = inject(LayoutFacade);
  readonly lightTheme = AG_THEME_LIGHT;
  readonly agTheme$ = this.layout.theme$.pipe(
    map((t) => (t === 'dark' ? AG_THEME_DARK : AG_THEME_LIGHT)),
  );

  readonly defaultColDef: ColDef = { sortable: true, resizable: true };

  readonly colDefs: ColDef<Quote>[] = [
    {
      headerName: 'Source', field: 'sourceId', width: 160,
      valueFormatter: (p) => this.sources.find((s) => s.id === p.value)?.displayName ?? p.value,
    },
    {
      headerName: 'Pair', field: 'pairId', width: 140,
      valueFormatter: (p) => this.pairs.find((pr) => pr.id === p.value)?.displayName ?? p.value,
    },
    { headerName: 'Bid',      field: 'bid',      width: 130, type: 'numericColumn', valueFormatter: (p) => formatPrice(p.value, 6) },
    { headerName: 'Ask',      field: 'ask',      width: 130, type: 'numericColumn', valueFormatter: (p) => formatPrice(p.value, 6) },
    { headerName: 'Mid',      field: 'mid',      width: 130, type: 'numericColumn', valueFormatter: (p) => formatPrice(p.value, 6) },
    { headerName: 'Spread %', field: 'spreadPct',width: 120, type: 'numericColumn', valueFormatter: (p) => formatSpreadPct(p.value) },
    { headerName: 'Time',     field: 'timestamp',width: 130, valueFormatter: (p) => formatTimestamp(p.value) },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['quotes']) this.rows = [...this.quotes];
  }

  onGridReady(_e: GridReadyEvent): void {}
}
