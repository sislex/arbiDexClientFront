/** API facade. Selects the live backend client when `VITE_API_BASE_URL` is set,
 * otherwise the self-contained mock (default). Store thunks import `api` and are
 * agnostic to the mode. */
import type { ApiClient } from './types';
import { IS_LIVE } from './config';
import { mockApi, setApiDelay } from './mock';
import { liveApi } from './live';

export const api: ApiClient = IS_LIVE ? liveApi : mockApi;

export { setApiDelay };
export { IS_LIVE } from './config';
export type { ApiClient } from './types';
