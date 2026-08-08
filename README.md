# Loxone DataManager

A modern, cross-platform viewer and editor for **Loxone Miniserver statistics** —
heavily inspired by [LoxStatEdit](https://github.com/mr-manuel/Loxone_LoxStatEdit).

<a href="https://www.buymeacoffee.com/andileeb"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=andileeb&button_colour=FFDD00&font_colour=000000&font_family=Lato&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a coffee" height="40"></a>

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
- **MCP server**: let AI assistants (Claude Code, Claude Desktop, …) browse, analyze,
  and fix your statistics through the app — see [MCP server](#mcp-server)

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

### Connecting remotely

The host field also accepts a Loxone Cloud DNS address —
`dns.loxonecloud.com/<serial>`, where `<serial>` is your Miniserver's serial number
(its MAC without separators, shown in Loxone Config) — which is resolved to the
Miniserver's current public address on every connect. The **port field still applies**: Cloud DNS only
publishes the Miniserver's *web* port, so FTP needs its own port reachable from
outside. That means opening TCP/21 (or your forwarded port) **and** the passive
data-port range on your router, which exposes admin credentials to the internet
unless FTP is set to *Enabled – TLS only*. A VPN into the LAN is the safer route and
needs no special address.

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

## Feedback & contributing

Found a bug or missing a feature? Open an [issue](../../issues) — the templates ask
for the few details that usually matter (app version, OS, Miniserver generation).

Pull requests are welcome; please run `pnpm test` and `pnpm run lint` first.

This is a hobby project maintained in spare time, so replies may take a while.

## MCP server

The app can expose an [MCP](https://modelcontextprotocol.io) server so AI assistants
can view **and edit** statistics — connect, list files, summarize and validate data,
fill gaps, apply formulas, edit records, save, and upload (Loxone's official MCP
server is read-only; this one can write, because it uses the app's FTP path).

1. Open **Settings** (gear icon or Cmd/Ctrl+,) → **MCP server** → enable it.
2. Copy the shown command, e.g. for Claude Code:

   ```sh
   claude mcp add --transport http loxone-datamanager http://127.0.0.1:12009/mcp \
     --header "Authorization: Bearer <token>"
   ```

   Any MCP client supporting Streamable HTTP works with the same URL + token.

3. Ask things like _"connect to my Miniserver, find gaps in last month's energy
   statistics and fill them"_ — destructive steps (upload, delete) always go through
   your client's tool-approval prompt.

The server listens on `127.0.0.1` only and runs while the app is open. The token can
be regenerated anytime in Settings.

## Roadmap

CSV import · resampling · old→new meter conversion · multi-month stitched charts ·
token-API read-only mode · signed builds + auto-update

## License

MIT — see [LICENSE](LICENSE). Not affiliated with Loxone Electronics GmbH.

Built with the help of [Claude Code](https://claude.com/claude-code).
