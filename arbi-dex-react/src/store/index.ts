import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { uiReducer } from './uiSlice';
import { authReducer } from './authSlice';
import { botsReducer } from './botsSlice';
import { marketConfigsReducer } from './marketConfigsSlice';
import { strategyConfigsReducer } from './strategyConfigsSlice';
import { catalogReducer } from './catalogSlice';
import { tradingReducer } from './tradingSlice';

const rootReducer = combineReducers({
  ui: uiReducer,
  auth: authReducer,
  bots: botsReducer,
  marketConfigs: marketConfigsReducer,
  strategyConfigs: strategyConfigsReducer,
  catalog: catalogReducer,
  trading: tradingReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type PreloadedState = Partial<RootState>;

export function makeStore(preloadedState?: PreloadedState) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
