/**
 * @deprecated Compatibility shim. The catalogue now comes from `src/services`
 * (mock TMDB adapter by default). Import `Movie` / `loadHomeCatalog` from
 * '../services' instead. This file will be removed once no consumers remain.
 */
export type { Movie, CatalogRow } from '../services/types';
export { loadHomeCatalog } from '../services';
