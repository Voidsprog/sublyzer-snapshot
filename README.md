<div align="center">

# Sublyzer Snapshot

<img src="./Sublyzer1.png" alt="Sublyzer Snapshot" width="96" />

**Local project health scanner for any Node.js codebase.**

Works **standalone** — no account required. Optionally sync to [Sublyzer](https://sublyzer.com) cloud when you want a live dashboard.

<br />

[![npm version](https://img.shields.io/npm/v/sublyzer-snapshot?style=for-the-badge&logo=npm&logoColor=white&label=npm)](https://www.npmjs.com/package/sublyzer-snapshot)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

<br />

[`Quick Start`](#-quick-start) · [`Standalone vs Cloud`](#-standalone-vs-cloud) · [`Monorepos`](#-monorepos) · [`Commands`](#-commands) · [`Roadmap`](#-roadmap)

<br />

```
  $ npx sublyzer-snapshot scan

  Scan root:     frontend (auto-selected)
  Stack:         Next.js (high)
  Health:        [████████░░] 84/100  grade B
  Routes:        42
  Build output:  12.4 MB (.next)
  ✓ Saved to .sublyzer/ (local)
```

</div>

---

## ✨ Introduction

**Sublyzer Snapshot** is an open-source CLI that scans your repo and answers:

> *How healthy is this project right now?*

It runs **entirely on your machine**: stack detection, routes, dependency audit, outdated packages, build size, git metadata, and a **0–100 health score**.

**Sublyzer cloud is optional** — use it when you want events in a shared dashboard, agents (Hermes), or team visibility. Without cloud, you still get reports, history, CI gates, and compare diffs.

---

## 🔀 Standalone vs Cloud

| | **Standalone (default)** | **Cloud (optional)** |
|---|--------------------------|----------------------|
| Account | None | [Sublyzer](https://sublyzer.com) integration code |
| Command | `npx sublyzer-snapshot scan` | `init --code …` then `run --push` |
| Output | Terminal + `.sublyzer/` history | + Sublyzer dashboard |
| CI | `scan --fail-on high` | + optional push via secret |

```bash
# Standalone — zero setup
npx sublyzer-snapshot scan

# Optional cloud link
npx sublyzer-snapshot init --code YOUR_24_CHAR_CODE -y
npx sublyzer-snapshot run --push
```

---

## 🚀 Quick start

### Install (use npx — recommended)

```bash
npx sublyzer-snapshot@latest --version
```

Do **not** run `npm i sublyzer-snapshot` in random folders — use `npx` to avoid unrelated peer dependency conflicts.

### Scan any project

```bash
cd your-project
npx sublyzer-snapshot scan
npx sublyzer-snapshot report --out HEALTH.md
npx sublyzer-snapshot compare
```

### Save preferences (local)

```bash
npx sublyzer-snapshot init --local
npx sublyzer-snapshot run
```

### Optional cloud sync

```bash
npx sublyzer-snapshot init --code YOUR_24_CHAR_CODE -y
npx sublyzer-snapshot run --push
npx sublyzer-snapshot open
```

---

## 📦 Monorepos

Snapshot **auto-picks** the best package in monorepos (npm/pnpm workspaces, `frontend/`, `backend/`, etc.).

```bash
# From repo root — auto-selects e.g. frontend/
npx sublyzer-snapshot scan

# Force a subfolder
npx sublyzer-snapshot scan --path backend
npx sublyzer-snapshot init --local --path frontend
```

On `init`, other scannable packages in the repo are listed as hints.

---

## 🧰 Commands

| Command | Description |
|---------|-------------|
| **`scan`** | Local scan — **no init, no account** |
| `init` | Save config — `--local` or `--code` for cloud |
| `run` | Scan + history (pushes in cloud mode or with `--push`) |
| `report` | Markdown report (`--out file.md`) |
| `compare` | Diff vs previous scan |
| `doctor` | Verify Node, scan target, optional cloud |
| `status` | Config + last scan |
| `ci` | GitHub Actions template |
| `pull` / `open` | Cloud only (read API / dashboard) |

### Flags

```bash
npx sublyzer-snapshot scan --path frontend
npx sublyzer-snapshot scan --fail-on high --json
npx sublyzer-snapshot run --local              # never push
npx sublyzer-snapshot run --push               # force cloud push
npx sublyzer-snapshot run --skip-audit         # faster
```

---

## 📊 What gets scanned

- **Stack** — Next.js, NestJS, Express, Fastify, Remix, Nuxt, SvelteKit, React, Vue
- **Routes** — `app/` / `pages/` or source patterns
- **Dependencies** + `npm audit` + outdated packages
- **Build size** — `dist/`, `.next/`, `build/` folders
- **Git** — branch, commit, dirty state
- **Health score** — 0–100, grade A–F

---

## 🔄 CI/CD

Local-only CI (no secrets):

```yaml
- run: npx sublyzer-snapshot@latest scan --fail-on high --json
```

Generate full workflow:

```bash
npx sublyzer-snapshot ci --out .github/workflows/sublyzer-snapshot.yml
```

Optional cloud push when `SUBLYZER_INTEGRATION_CODE` secret is set.

---

## 🔐 Environment variables

| Variable | When |
|----------|------|
| `SUBLYZER_INTEGRATION_CODE` | Cloud `init` |
| `SUBLYZER_READ_KEY` | Cloud `pull` |
| `SUBLYZER_API_URL` | Custom API (default: `https://api.sublyzer.com`) |

---

## 📁 Local data

```
your-project/
└── .sublyzer/           # gitignored on init
    ├── snapshot.json    # config (local or cloud)
    ├── last-snapshot.json
    └── history/         # for compare
```

---

## 🛣️ Roadmap

- [x] npm publish — [sublyzer-snapshot](https://www.npmjs.com/package/sublyzer-snapshot)
- [x] Standalone `scan` (no account)
- [x] Local vs cloud modes
- [x] Monorepo auto-target (`frontend/`, workspaces)
- [x] Build output size scan
- [x] Health score + compare + report + CI template
- [ ] `login` OAuth (no manual code paste)
- [ ] SARIF export for GitHub Security
- [ ] PR comment bot
- [ ] Python / Go stack detection

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">

**[npm](https://www.npmjs.com/package/sublyzer-snapshot)** · **[Sublyzer Cloud](https://sublyzer.com)** · **[Docs](https://sublyzer.com/docs)**

<sub>Standalone by default · Cloud when you need it</sub>

</div>
