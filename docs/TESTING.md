# Testing

- `npm test` runs the Vitest suite (jsdom). No env vars are needed: every service uses its mock adapter by default.
- `npm run test:coverage` runs the suite with `@vitest/coverage-v8`, scoped to `src/services/**` and `src/state/**`
  (config in `vitest.config.ts`, 70% line threshold). The HTML report goes to `coverage/` (git-ignored).

## Line coverage (w3-unit)

| Area                  | Before | After  |
| --------------------- | ------ | ------ |
| `src/services/db`     | 88.37% | 93.37% |
| `src/services/db/mock.ts` | 41.53% | 98.46% |
| `src/state` (`store.ts`) | 78.46% | 90.51% |
| services + state total | 89.35% | 93.33% |

"Before" was measured running only the `src/services` + `src/state` test files; "After" is the full
`npm run test:coverage` run (component/page tests also exercise services), where `src/services` root
files reach 93.09% and `src/state` 90.51%.

Other service folders were already well covered before this task: analytics 95.4%, auth 84.4%,
billing (mock) 97.7%, tmdb (live URL building against stubbed `fetch`) 94.6%, sync/syncEngine 98.8% / 90%.

New tests:

- `src/services/db/mock.test.ts` — mock DB adapter: profile upsert/merge, persistence across instances,
  idempotent list add/remove, progress clamping, null cloud snapshot, corrupt-storage recovery.
- `src/state/store.test.ts` — store slices: profiles (min one, active fallback), watchlist toggle per
  media type, history/continue-watching, ratings metadata retention, view history, no-active-profile
  no-ops, and persisted-state rehydration via `merge`.
