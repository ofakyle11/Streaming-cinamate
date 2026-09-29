# Performance pass (w3-perf)

## Checks

- **Route-level code splitting**: every page in `src/app/router.tsx` is `React.lazy` (Home, Title, Search, MyList, Profiles, Account, Plans, Genre, NewPopular, NotFound). Verified — no change needed.
- **Images**: all content `<img>` use `loading="lazy"` + `decoding="async"` and now carry intrinsic `width`/`height` (2:3 posters/cast, 30x30 provider logos, 40x60 history thumbs); CSS sizes/`aspect-ratio` still govern layout. The title backdrop stays eager (above the fold, absolutely positioned — no layout shift).
- **Preconnect**: `index.html` adds `preconnect` + `dns-prefetch` for `https://image.tmdb.org` (no `crossorigin`, matching how images are requested).
- **Hover prefetch**: `src/app/prefetch.ts` `prefetchTitleRoute()` imports the TitlePage chunk once on `pointerenter` of a `MovieCard`.
- **Vendor splitting**: largest entry chunk is 106.8 kB gzip (< 200 kB threshold), so `vite.config.ts` is unchanged.

## Bundle sizes (vite build, gzip)

| Chunk | Before | After |
| --- | --- | --- |
| index (main entry) | 318.24 kB / 106.76 kB gz | 318.25 kB / 106.77 kB gz |
| index (second shared chunk) | 227.80 kB / 59.26 kB gz | 227.80 kB / 59.26 kB gz |
| TitlePage | 12.61 kB / 4.65 kB gz | 12.68 kB / 4.68 kB gz |
| Home | 15.83 kB / 6.46 kB gz | unchanged |
| index.css | 28.26 kB / 6.52 kB gz | unchanged |

No behavior changes; the size deltas are the new attributes and prefetch helper.
