# CLAUDE.md — Loxone DataManager

Electron desktop app (100% TypeScript) to view and **edit** Loxone Miniserver
statistics: browse `/stats` via FTP/FTPS, chart/edit the binary monthly files,
upload them back. Heavily inspired by LoxStatEdit (Windows/.NET).
User-facing docs live in README.md; this file is for working on the code.

## Commands (pnpm only — packageManager is pinned)

```bash
pnpm install          # pnpm 10: build scripts allowlisted via pnpm.onlyBuiltDependencies
pnpm run dev          # Electron + Vue with HMR
pnpm test             # vitest: parser round-trip, validation, formula, FTP date parsing
pnpm run build        # typecheck (node + web) + electron-vite build
pnpm run lint         # eslint + prettier rules
pnpm run build:mac    # package .dmg (build:win / build:linux)
```

Release: push a `v*` tag → `.github/workflows/release.yml` builds macOS universal
.dmg + Windows NSIS setup.exe (unsigned) and drafts a GitHub Release.

## Architecture

- `src/main/` — Node/Electron main process. ALL FTP + file I/O lives here.
  - `ftp.ts` — one basic-ftp Client in a module singleton; every op serialized
    through a promise queue (`run()`) with one auto-reconnect retry; TLS
    auto-detect = try FTPS (`secure: true`, `rejectUnauthorized: false` — Miniserver
    certs are self-signed) then fall back to plain. LIST dates have no year →
    `parseListDate` heuristic (assume this year unless future).
  - `statfile.ts` — binary parser/serializer, **pure TS, no Electron imports**
    (unit-testable). See "Binary format" below.
  - `cache.ts` — per-host download cache in `userData/stats-cache/<host>/`.
    `cachePath()` validates names against `STAT_FILENAME_RE` (path-traversal guard).
  - `store.ts` — saved connections: plain JSON in userData + passwords encrypted
    with Electron `safeStorage` (no keychain → password simply not stored).
  - `ipc.ts` — all handlers. Every response is `IpcResult<T> = {ok,data}|{ok,error}`
    with typed `ApiError.code` (e.g. `FTP_REFUSED` triggers the "enable FTP" hint
    in the UI). Parsed files are kept in a Map so serialization re-emits the
    original header bytes verbatim.
- `src/preload/index.ts` — contextBridge exposing `window.api`, typed by the
  single contract interface in `src/shared/api.ts` (preload implements it,
  renderer consumes it — extend the interface first when adding IPC).
- `src/shared/` — types + `time.ts` (Loxone epoch helpers) used by both sides.
- `src/renderer/src/` — Vue 3 + Pinia + PrimeVue 4 + uPlot. Views: Connection →
  Browser (file list w/ sync status) → Editor (chart + virtualized grid +
  problems panel). Router guard: everything except `/connect` needs a connection.

## Domain knowledge (hard-won, don't rediscover)

- **Binary stat file** (little-endian): header `u16 valueCount, u16 unknown
  (often 0x8000), u32 controlType, i32 textLen, utf8 name, 0x00, zero-pad to
  stride`; then records `u16 uuidFrag1 (3rd uuid group), u16 uuidFrag2 (2nd
  group), u32 ts (seconds since 2009-01-01), valueCount × f64, pad to stride`.
- **Stride ambiguity**: for valueCount ≥ 3 LoxStatEdit (`8+8n+8`) and sarnau
  (slot buckets 1/3/7/10) disagree. `parseStatFile` detects empirically per file
  (divisibility + uuid frags + ascending ts). Real 3+-value fixture files wanted
  in `tests/fixtures/` (auto-round-trip-tested).
- **Byte fidelity invariant**: serialization re-emits stored `headerBytes`
  verbatim; round-trip must be byte-identical (tests enforce). Never "normalize"
  the header.
- Timestamps are displayed **as stored** (UTC component formatting, no TZ
  conversion) — exactly like LoxStatEdit. Loxone epoch offset = 1230768000.
- **Write path is FTP-only** (no HTTP/WS API can write stats). Firmware 16.1+
  ships FTP **disabled**; Loxone Config → Miniserver network settings enables it.
- After upload the Miniserver must be **restarted** + Loxone app cache cleared —
  the UI shows this checklist; keep it.
- Current-month files are still being appended by the Miniserver → editor warns.
- Loxone's official MCP server (fw 17.1) reads history but cannot write; it's a
  potential read-only add-on, never a replacement for FTP.

## Constraints & gotchas

- **Licensing: MIT-only dependencies.** PrimeVue is pinned to the 4.x line and
  primeicons to 7.x — v5/v8+ are under the commercial "PrimeUI" license
  (license key + eligibility). Do NOT upgrade these majors. If PrimeVue 4
  becomes unmaintained, migrate to an MIT alternative (e.g. Naive UI).
- Renderer CSP forbids eval → bulk-edit formulas use the hand-rolled parser in
  `renderer/src/lib/formula.ts`. Don't replace it with `new Function`.
- Vue reactive proxies **cannot cross the contextBridge** ("object could not be
  cloned") — clone to plain objects before any `window.api` call that sends
  records (see `plain()` in `stores/editor.ts`).
- pnpm 10 blocks dependency postinstall scripts; `electron`, `electron-winstaller`,
  `esbuild` are allowlisted in package.json — without this Electron's binary
  never downloads.
- `npmRebuild: false` in electron-builder.yml (no native modules — keep it that way).

## Testing

- `pnpm test`: fixtures are **built in-memory** by `tests/build-statfile.ts`
  (independent byte-level builder so round-trip tests aren't circular), both
  stride variants, plus the adversarial size-divisible-by-both case.
- E2E: no committed harness; the pattern that works is Playwright `_electron`
  driving the built app against a local `ftp-srv` fake Miniserver with generated
  stat files (connect → browse → download → edit → save → upload → verify bytes
  on the server → delete). Rebuild (`pnpm run build`) before driving — the app
  loads from `out/`.
- Before a release run `docs/e2e-checklist.md` against a real Gen 2 Miniserver.

## Roadmap (agreed, not built)

CSV import · resampling · old→new meter conversion · multi-month stitched
charts · token-API read-only mode (statisticV2 meters, no FTP) · signed builds +
auto-update (needs Apple Developer ID) · MCP integration.
