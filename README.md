# Loxone DataManager

A modern, cross-platform viewer and editor for **Loxone Miniserver statistics** —
heavily inspired by [LoxStatEdit](https://github.com/mr-manuel/Loxone_LoxStatEdit).

Browse the statistics stored on your Miniserver's SD card, chart them, fix broken
entries (spikes, gaps, wrong meter readings), and upload the corrected files back —
all from an installable desktop app for macOS and Windows. No config files: enter
your Miniserver connection in the app.

## Features

- **Browse** `/stats` on the Miniserver via FTP/FTPS: file list with stat name, month,
  size, modification date, and local sync status
- **Chart + grid viewer** for the binary stat files (handles 40k+ entries per month
  smoothly), with validation ("Problems") like LoxStatEdit: wrong UUIDs, unordered
  timestamps, out-of-month entries, NaN values
- **Edit**: change timestamps and values inline, insert/delete entries, fill gaps with
  interpolated entries, bulk-calculate (`v * 1000`, `(v - 32) / 1.8`, …)
- **Round-trip safe**: files are re-serialized byte-identically (verified by tests) —
  only what you change changes
- **Upload back** to the Miniserver, with a post-upload checklist (restart + app cache)
- **CSV export**, saved connections (password in the OS keychain), Gen 1 and Gen 2 support

## Installation

Download the latest release from [GitHub Releases](../../releases):

- **macOS**: `loxone-datamanager-<version>.dmg`
- **Windows**: `loxone-datamanager-<version>-setup.exe`

The builds are currently **unsigned**, so the OS will warn on first launch:

- **macOS**: Gatekeeper blocks the app. Either right-click → Open (older macOS), or on
  macOS 15+ go to **System Settings → Privacy & Security → "Open Anyway"**. Alternatively:
  `xattr -dr com.apple.quarantine "/Applications/Loxone DataManager.app"`
- **Windows**: SmartScreen shows "Windows protected your PC" → **More info → Run anyway**.

## Enable FTP on your Miniserver (firmware 16.1+)

Since firmware 16.1 the Miniserver's FTP server is **disabled by default**. In
**Loxone Config**: select the Miniserver → network settings → set **FTP** to
*Enabled* or *Enabled – TLS only*, then save to the Miniserver. The app's
"Auto-detect" encryption mode tries FTPS first and falls back to plain FTP.

Connect with a Miniserver **admin** user.

## Important notes on editing

- Statistics live in monthly binary files `/stats/<uuid>.<yyyyMM>` on the SD card.
  The format is community-reverse-engineered (LoxStatEdit,
  [sarnau/Inside-The-Loxone-Miniserver](https://github.com/sarnau/Inside-The-Loxone-Miniserver)).
- After uploading an edited file, changes only appear once you **restart the
  Miniserver** and **clear the Loxone app's cache** (or remove/re-add the Miniserver
  in the app).
- Editing the **current month's** file is risky — the Miniserver keeps appending to it.
- Statistics of the newest meter/energy blocks ("statisticV2") use additional files
  (`<uuid>_1…_9.<yyyyMM>`); classic editing applies, but semantics differ per suffix
  (`_1` power, `_2` meter reading, `_3` storage level).

## Development

```bash
pnpm install
pnpm run dev        # Electron + Vue with HMR
pnpm test           # parser round-trip + validation + formula tests
pnpm run build      # typecheck + production build
pnpm run build:mac  # package .dmg (or build:win / build:linux)
```

Stack: Electron (main process: [basic-ftp](https://github.com/patrickjuchli/basic-ftp),
binary parser in TypeScript) + Vue 3, Pinia, PrimeVue 4, uPlot. Releases are built by
`.github/workflows/release.yml` on `v*` tags.

If you have real stat files with **3+ values per entry**, please drop anonymized copies
into `tests/fixtures/` (they are round-trip tested automatically) — the record layout
for those files has two conflicting community interpretations and real samples help
confirm the auto-detection.

## Roadmap

MCP integration

## License

MIT — see [LICENSE](LICENSE). Not affiliated with Loxone Electronics GmbH.
