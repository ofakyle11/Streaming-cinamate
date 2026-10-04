# Testing

- `npm test` runs the Vitest suite (jsdom). No env vars are needed: every service uses its mock adapter by default.
- `npm run test:coverage` runs the suite with `@vitest/coverage-v8`, scoped to `src/services/**` and `src/state/**`
  (config in `vitest.config.ts`, 70% line threshold). The HTML report goes to `coverage/` (git-ignored).

## Line coverage (w3-unit)

| Area                      | Before | After  |
| ------------------------- | ------ | ------ |
| `src/services/db`         | 88.37% | 93.37% |
| `src/services/db/mock.ts` | 41.53% | 98.46% |
| `src/state` (`store.ts`)  | 78.46% | 90.51% |
| services + state total    | 89.35% | 93.33% |

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

## End-to-end (Playwright)

- `npm run e2e` runs every Playwright project; `npm run e2e:surfaces` runs only the device matrix.
- The config starts `npm run build` + `vite preview` itself. Override the port with `E2E_PORT=4177`
  (default 4173) and the build output dir with `E2E_OUT_DIR` (default `dist`).
- `e2e/smoke.spec.ts` runs on the single `chromium` desktop project.

### Device matrix

`e2e/surfaces.spec.ts` runs once per project below (all Chromium, built from a data table in
`playwright.config.ts`). Each device has a `-light` and a `-dark` project (`colorScheme`):

| Project stem     | Viewport  | Notes                              |
| ---------------- | --------- | ---------------------------------- |
| `iphone-se`      | 375x667   | phone: mobile viewport + touch     |
| `iphone-15-pro`  | 393x852   | phone: mobile viewport + touch     |
| `pixel-8`        | 412x915   | phone: mobile viewport + touch     |
| `ipad-portrait`  | 768x1024  | tablet (menu button, bottom sheet) |
| `ipad-landscape` | 1024x768  | tablet (menu button, bottom sheet) |
| `desktop-1280`   | 1280x800  | desktop                            |
| `desktop-1440`   | 1440x900  | desktop                            |
| `desktop-1920`   | 1920x1080 | desktop                            |

Two more projects set `reducedMotion: 'reduce'` (light): `iphone-15-pro-reduced-motion` and
`desktop-1440-reduced-motion`. The "reduced motion" test runs only on those two and is skipped elsewhere.

Run one project:

```sh
npx playwright test --project=iphone-se-dark
```

What the matrix checks on every project: the Primary nav is at most 72px tall, the page never scrolls
sideways, the hero and its "Where to watch" button are visible (`.hero-screen` is edge to edge at
<= 480px and inset above), the first poster row has a card, the Menu button is >= 44px and opens the
Series link at <= 1024px (Series is inline above that), every `input` on `/search` is >= 16px, and on
the title page "Where to watch" scrolls `#where-to-watch` into view while "Trailer" opens a dialog that
is a full-width bottom sheet at <= 1024px and a centred card above.

WebKit: local runs never need WebKit. When `PW_WEBKIT=1` is set (CI sets it and installs
`chromium webkit`), the two iPhone devices also get `*-webkit` projects
(e.g. `iphone-se-light-webkit`), so the iOS Safari engine covers the phone breakpoints.
