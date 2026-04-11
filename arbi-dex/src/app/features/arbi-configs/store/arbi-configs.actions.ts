import { createAction, props } from '@ngrx/store';
import { ArbiConfig } from '../../../shared/models';
import {
  CreateArbiConfigPayload,
  UpdateArbiConfigPayload,
  ArbiConfigPricesResponse,
} from '../services/arbi-configs.service.interface';

// ── Load all ──
export const loadArbiConfigs = createAction('[ArbiConfigs] Load');
export const loadArbiConfigsSuccess = createAction(
  '[ArbiConfigs] Load Success',
  props<{ configs: ArbiConfig[] }>(),
);
export const loadArbiConfigsFailure = createAction(
  '[ArbiConfigs] Load Failure',
  props<{ error: string }>(),
);

// ── Load one ──
export const loadArbiConfig = createAction(
  '[ArbiConfigs] Load One',
  props<{ id: string }>(),
);
export const loadArbiConfigSuccess = createAction(
  '[ArbiConfigs] Load One Success',
  props<{ config: ArbiConfig }>(),
);
export const loadArbiConfigFailure = createAction(
  '[ArbiConfigs] Load One Failure',
  props<{ error: string }>(),
);

// ── Create ──
export const createArbiConfig = createAction(
  '[ArbiConfigs] Create',
  props<{ payload: CreateArbiConfigPayload }>(),
);
export const createArbiConfigSuccess = createAction(
  '[ArbiConfigs] Create Success',
  props<{ config: ArbiConfig }>(),
);
export const createArbiConfigFailure = createAction(
  '[ArbiConfigs] Create Failure',
  props<{ error: string }>(),
);

// ── Update ──
export const updateArbiConfig = createAction(
  '[ArbiConfigs] Update',
  props<{ id: string; payload: UpdateArbiConfigPayload }>(),
);
export const updateArbiConfigSuccess = createAction(
  '[ArbiConfigs] Update Success',
  props<{ config: ArbiConfig }>(),
);
export const updateArbiConfigFailure = createAction(
  '[ArbiConfigs] Update Failure',
  props<{ error: string }>(),
);

// ── Delete ──
export const deleteArbiConfig = createAction(
  '[ArbiConfigs] Delete',
  props<{ id: string }>(),
);
export const deleteArbiConfigSuccess = createAction(
  '[ArbiConfigs] Delete Success',
  props<{ id: string }>(),
);
export const deleteArbiConfigFailure = createAction(
  '[ArbiConfigs] Delete Failure',
  props<{ error: string }>(),
);

// ── Prices ──
export const loadArbiConfigPrices = createAction(
  '[ArbiConfigs] Load Prices',
  props<{ id: string }>(),
);
export const loadArbiConfigPricesSuccess = createAction(
  '[ArbiConfigs] Load Prices Success',
  props<{ id: string; pricesResponse: ArbiConfigPricesResponse }>(),
);
export const loadArbiConfigPricesFailure = createAction(
  '[ArbiConfigs] Load Prices Failure',
  props<{ error: string }>(),
);

