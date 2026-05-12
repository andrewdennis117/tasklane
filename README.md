# Tasklane

Personal task aggregator for Linear + GitHub, built as a native desktop app.

## Stack

- **Tauri v2** (Rust backend, web frontend)
- **React + TypeScript** (frontend)
- **SQLite** (local task cache)
- **macOS Keychain** (API key storage)

## Quick Start

```bash
bun install
bun run tauri dev
```

## Requirements

- macOS (primary target)
- [Bun](https://bun.sh/) package manager
- [Rust](https://rustup.rs/) toolchain
- Linear personal API key (create at [linear.app/settings/api](https://linear.app/settings/api))

## Current Status

**Phase 1** (read-only Linear):
- Settings screen to connect Linear API key
- View open Linear issues grouped by status
- Manual refresh to re-sync

Upcoming phases will add GitHub integration, background sync, and write capabilities.
