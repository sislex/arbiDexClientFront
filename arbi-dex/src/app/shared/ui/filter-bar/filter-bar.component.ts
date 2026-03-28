import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterBarState {
  search: string;
  sourceType: string;
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatSelectModule, MatButtonModule],
  template: `
    <div class="filter-bar">
      <mat-form-field appearance="outline" class="filter-bar__search">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput placeholder="Search…" [(ngModel)]="searchValue" (ngModelChange)="onSearch($event)" />
        <button *ngIf="searchValue" matSuffix mat-icon-button (click)="clearSearch()">
          <mat-icon>close</mat-icon>
        </button>
      </mat-form-field>
      <mat-form-field *ngIf="sourceTypeOptions?.length" appearance="outline" class="filter-bar__select">
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="typeValue" (ngModelChange)="onTypeChange($event)">
          <mat-option value="">All</mat-option>
          <mat-option *ngFor="let opt of sourceTypeOptions" [value]="opt.value">{{ opt.label }}</mat-option>
        </mat-select>
      </mat-form-field>
      <button *ngIf="searchValue || typeValue" mat-stroked-button (click)="reset()">Reset</button>
    </div>
  `,
  styles: [`
    @use 'styles/tokens' as t;
    .filter-bar {
      display: flex;
      align-items: center;
      gap: t.$spacing-sm;
      flex-wrap: wrap;
      margin-bottom: t.$spacing-lg;
      &__search { flex: 1; min-width: 200px; }
      &__select { width: 160px; }
    }
  `],
})
export class FilterBarComponent {
  @Input() sourceTypeOptions?: FilterOption[];
  @Output() filterChange = new EventEmitter<FilterBarState>();

  searchValue = '';
  typeValue = '';

  private search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.emit());
  }

  onSearch(val: string): void { this.search$.next(val); }
  onTypeChange(_: string): void { this.emit(); }

  clearSearch(): void { this.searchValue = ''; this.emit(); }
  reset(): void { this.searchValue = ''; this.typeValue = ''; this.emit(); }

  private emit(): void {
    this.filterChange.emit({ search: this.searchValue, sourceType: this.typeValue });
  }
}

