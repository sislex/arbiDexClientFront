import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, GridApi, RowClickedEvent } from 'ag-grid-community';
import { map } from 'rxjs/operators';
import { Subscription, Source, TradingPair } from '../../models';
import { LoadingStateComponent } from '../loading-state/loading-state.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { LayoutFacade } from '../../../features/layout/facades/layout.facade';
import { AG_THEME_LIGHT, AG_THEME_DARK } from '../../utils/ag-grid-themes';
import { ensureAgGridModules } from '../../utils/ag-grid-setup';

@Component({
  selector: 'app-subscriptions-table',
  standalone: true,
  imports: [CommonModule, AsyncPipe, AgGridAngular, LoadingStateComponent, EmptyStateComponent],
  template: `
    <div class="subs-table">
      <app-loading-state *ngIf="loading" label="Loading subscriptions…" />
      <app-empty-state
        *ngIf="!loading && rows.length === 0"
        icon="bookmark_border"
        title="No subscriptions yet"
        description="Add sources and pairs to start monitoring quotes"
        actionLabel="Go to Market Catalog"
        (action)="addClicked.emit()" />
      <ag-grid-angular
        *ngIf="!loading && rows.length > 0"
        [theme]="(agTheme$ | async) ?? lightTheme"
        [rowData]="rows"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [domLayout]="'autoHeight'"
        [animateRows]="true"
        [rowStyle]="{ cursor: 'pointer' }"
        (rowClicked)="onRowClicked($event)"
        (gridReady)="onGridReady($event)" />
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .subs-table { width: 100%; }
    ag-grid-angular { width: 100%; border-radius: t.$radius-md; overflow: hidden; }
  `],
})
export class SubscriptionsTableComponent implements OnChanges {
  constructor() { ensureAgGridModules(); }

  @Input() subscriptions: Subscription[] = [];
  @Input() sources: Source[] = [];
  @Input() pairs: TradingPair[] = [];
  @Input() loading = false;
  @Output() remove = new EventEmitter<string>();
  @Output() toggle = new EventEmitter<string>();
  @Output() view = new EventEmitter<string>();
  @Output() addClicked = new EventEmitter<void>();

  rows: Subscription[] = [];
  private gridApi?: GridApi;
  private readonly el = inject(ElementRef);
  private readonly layout = inject(LayoutFacade);

  readonly lightTheme = AG_THEME_LIGHT;
  readonly agTheme$ = this.layout.theme$.pipe(
    map((t) => (t === 'dark' ? AG_THEME_DARK : AG_THEME_LIGHT)),
  );

  readonly defaultColDef: ColDef = { sortable: true, resizable: true };

  readonly colDefs: ColDef<Subscription>[] = [
    {
      headerName: 'Source', field: 'sourceId', width: 180,
      valueFormatter: (p) => this.sources.find((s) => s.id === p.value)?.displayName ?? p.value,
    },
    {
      headerName: 'Pair', field: 'pairId', width: 160,
      valueFormatter: (p) => this.pairs.find((pr) => pr.id === p.value)?.displayName ?? p.value,
    },
    { headerName: 'Status',  field: 'enabled',   width: 120, valueFormatter: (p) => (p.value ? 'Active' : 'Inactive') },
    { headerName: 'Created', field: 'createdAt',  width: 180, valueFormatter: (p) => new Date(p.value).toLocaleString() },
    {
      headerName: 'Actions', field: 'id', width: 260, sortable: false,
      cellRenderer: (p: { value: string; data: Subscription }) => {
        const lbl = p.data.enabled ? 'Disable' : 'Enable';
        return `<span data-action="view"   data-id="${p.value}" style="margin-right:8px;cursor:pointer;color:#0ecb81">View Chart</span>`
             + `<span data-action="toggle" data-id="${p.value}" style="margin-right:8px;cursor:pointer;color:#3b82f6">${lbl}</span>`
             + `<span data-action="remove" data-id="${p.value}" style="cursor:pointer;color:#ef4444">Remove</span>`;
      },
    },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subscriptions']) this.rows = [...this.subscriptions];
  }

  onRowClicked(event: RowClickedEvent<Subscription>): void {
    // Игнорируем клик по кнопкам Actions
    const target = event.event?.target as HTMLElement | undefined;
    if (target?.closest('[data-action]')) return;
    if (event.data?.id) this.view.emit(event.data.id);
  }

  onGridReady(e: GridReadyEvent): void {
    this.gridApi = e.api;
    (this.el.nativeElement as HTMLElement).addEventListener('click', (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      const action = t.dataset['action'];
      const id = t.dataset['id'];
      if (!action || !id) return;
      if (action === 'remove') this.remove.emit(id);
      if (action === 'toggle') this.toggle.emit(id);
      if (action === 'view')   this.view.emit(id);
    });
  }
}
