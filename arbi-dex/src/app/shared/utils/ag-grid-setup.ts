import {
  ModuleRegistry,
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  ValidationModule,
} from 'ag-grid-community';

let registered = false;

/** Регистрирует AG Grid модули один раз (вызывать в компонентах с ag-grid-angular) */
export function ensureAgGridModules(): void {
  if (registered) return;
  ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    TextFilterModule,
    NumberFilterModule,
    ValidationModule,
  ]);
  registered = true;
}

