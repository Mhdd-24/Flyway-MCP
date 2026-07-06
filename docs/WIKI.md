# Flyway MCP — Project Wiki

Complete guide for **@mhdd_24/flyway-mcp**: what it does, how it works, setup from scratch, daily usage, and maintainer workflow after npm publish.

---

## Table of contents

1. [What this project does](#1-what-this-project-does)
2. [High-level architecture](#2-high-level-architecture)
3. [How project discovery works](#3-how-project-discovery-works)
4. [Complete setup for a new user](#4-complete-setup-for-a-new-user)
5. [What happens after installing the package](#5-what-happens-after-installing-the-package)
6. [Configuration reference](#6-configuration-reference)
7. [Using the MCP tools](#7-using-the-mcp-tools)
8. [Migration flow (end to end)](#8-migration-flow-end-to-end)
9. [Automatic error remediation](#9-automatic-error-remediation)
10. [Project folder structure](#10-project-folder-structure)
11. [Source code reference](#11-source-code-reference)
12. [Environment variables](#12-environment-variables)
13. [Local development](#13-local-development)
14. [Connecting MCP clients](#14-connecting-mcp-clients)
15. [Extending the project](#15-extending-the-project)
16. [Troubleshooting](#16-troubleshooting)
17. [Publishing and post-release](#17-publishing-and-post-release)

---

## 1. What this project does

**flyway-mcp** is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server. It lets AI assistants (Cursor, Claude, Copilot, etc.) run **Flyway repair and migrate** across multiple database projects using natural language.

Example prompts:

> Run **QA Flyway Migration**.

> Run **Dev Flyway Migration** for `Orders_DB` and `Inventory_DB`.

The server exposes three tools:

| Tool | Role |
|------|------|
| `list_flyway_projects` | Discover Flyway projects under `FLYWAY_ROOT` |
| `qa_flyway_migration` | Repair + migrate all (or selected) projects against QA |
| `dev_flyway_migration` | Repair + migrate all (or selected) projects against Development |

**Important:** This MCP server shells out to the **Flyway CLI** on your machine. Database connection strings and credentials live in each project's `flyway.toml` / `flyway_qa.toml` / `flyway_dev.toml` — not in MCP env vars.

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MCP client (Cursor, Claude Desktop, VS Code, …)               │
│  stdio JSON-RPC — tools/list, tools/call                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/index.ts                                                    │
│  McpServer + StdioServerTransport                                │
│  registerTools() → list | qa_migration | dev_migration           │
└────────────────────────────┬─────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│ projectDiscovery│ │ migrationService│ │ errorAnalyzer +         │
│ (scan FLYWAY_   │ │ (orchestrate    │ │ errorRemediator         │
│  ROOT)          │ │  per project)   │ │ (fix + retry loop)      │
└────────┬────────┘ └────────┬────────┘ └───────────┬─────────────┘
         │                   │                      │
         ▼                   ▼                      ▼
   filesystem           flywayRunner            migration files
   FLYWAY_ROOT          spawn flyway CLI        under migrations/
```

### Layer responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| **Entry** | `src/index.ts` | Boot MCP server, validate env, register tools |
| **Config** | `src/config/flyway.config.ts` | All constants (`FW`) — messages, tool metadata, config file names |
| **Interfaces** | `src/interfaces/flyway.ts` | TypeScript contracts (no runtime logic) |
| **Tools** | `src/tools/` | MCP tool schemas + handlers (Zod + `server.tool`) |
| **Services** | `src/services/` | Discovery, Flyway CLI, migration orchestration, remediation |
| **Env** | `src/env.ts` | Read `process.env` with aliases and defaults |

---

## 3. How project discovery works

The server scans `FLYWAY_ROOT` for **immediate child directories** that look like Flyway projects.

A folder qualifies when it contains:

| File | Required |
|------|----------|
| `flyway.toml` | Yes (base config) |
| `flyway_qa.toml` | At least one of QA or Dev |
| `flyway_dev.toml` | At least one of QA or Dev |

Projects are sorted alphabetically by folder name.

### Optional filter

Set `FLYWAY_PROJECTS` to a comma-separated list of folder names to limit which projects run:

```
FLYWAY_PROJECTS=Orders_DB,Billing_DB
```

You can also pass a `projects` array on `qa_flyway_migration` / `dev_flyway_migration` per call.

### Expected layout

```
FLYWAY_ROOT/
├── Orders_DB/
│   ├── flyway.toml
│   ├── flyway_qa.toml
│   ├── flyway_dev.toml
│   └── migrations/
│       ├── V1__init.sql
│       └── V2__add_index.sql
└── Inventory_DB/
    ├── flyway.toml
    ├── flyway_qa.toml
    └── migrations/
        └── ...
```

---

## 4. Complete setup for a new user

Follow these steps in order.

### Step 1 — Install Node.js

Install **Node.js 18 or later** from [nodejs.org](https://nodejs.org/).

Verify:

```bash
node --version   # v18.x or higher
```

### Step 2 — Install Flyway CLI and Java

1. Install a **JDK** (Flyway requires Java).
2. Install **Flyway** and ensure it is on PATH.

Verify:

```bash
flyway -v
```

If Flyway is not on PATH, set `FLYWAY_CLI` to the full executable path in MCP config.

### Step 3 — Prepare your Flyway projects

Each database project under `FLYWAY_ROOT` should have:

- `flyway.toml` — shared settings
- `flyway_qa.toml` and/or `flyway_dev.toml` — environment-specific overrides (JDBC URL, schemas, etc.)
- `migrations/` — versioned SQL/JS migration files

### Step 4 — Install the package

**Published package (end users):**

```bash
npm install -g @mhdd_24/flyway-mcp
```

Or use without global install:

```bash
npx @mhdd_24/flyway-mcp
```

**From source (developers):**

```bash
git clone https://github.com/Mhdd-24/Flyway-MCP.git
cd Flyway-MCP
npm install
npm run build
```

### Step 5 — Configure your MCP client

See [§14 Connecting MCP clients](#14-connecting-mcp-clients).

Minimum `env` block:

```json
{
  "FLYWAY_ROOT": "C:/path/to/your/Flyway"
}
```

### Step 6 — Restart the MCP server

- **Cursor:** Settings → MCP → restart / toggle off-on, or restart Cursor.
- **Claude Desktop:** Quit and reopen Claude after editing config.

Check stderr for: `Flyway MCP Server Started`

### Step 7 — Verify with `list_flyway_projects`

In chat:

> Use flyway **list_flyway_projects**.

Expected output lists each project with QA/Dev availability and full path.

### Step 8 — Run your first migration

> Run **QA Flyway Migration**.

Review the per-project summary. Failed projects include Flyway output and any remediations attempted.

---

## 5. What happens after installing the package

### npm install / npx

| Step | What happens |
|------|----------------|
| Download | Package `@mhdd_24/flyway-mcp` fetched from npm registry |
| Contents | `dist/` (compiled JS), `README.md`, `docs/WIKI.md`, `package.json` |
| Bin | `flyway-mcp` → `dist/index.js` (shebang `#!/usr/bin/env node`) |
| Dependencies | `@modelcontextprotocol/sdk`, `zod`, `dotenv` installed |

The published package **includes pre-built `dist/`** — end users do not run `tsc`.

### MCP client startup

1. Client spawns `npx @mhdd_24/flyway-mcp` (or `flyway-mcp` / `node dist/index.js`).
2. `validateEnv()` logs a warning if `FLYWAY_ROOT` is unset.
3. Three tools registered over stdio.
4. Server waits for `tools/call` from the AI.

---

## 6. Configuration reference

### MCP `env` block (typical)

```json
{
  "FLYWAY_ROOT": "C:/path/to/your/Flyway",
  "FLYWAY_CLI": "flyway",
  "FLYWAY_MAX_RETRIES": "3",
  "FLYWAY_PROJECTS": "Orders_DB,Billing_DB"
}
```

### Per-project Flyway config

Connection details are **not** passed through MCP env. Each project uses Flyway's native config files:

| File | Used when |
|------|-----------|
| `flyway.toml` | Always loaded (base) |
| `flyway_qa.toml` | `qa_flyway_migration` |
| `flyway_dev.toml` | `dev_flyway_migration` |

The CLI is invoked with `-configFiles=flyway.toml,flyway_qa.toml` (or `_dev`) from the project directory.

---

## 7. Using the MCP tools

### `list_flyway_projects`

No parameters.

Returns every discovered project under `FLYWAY_ROOT` with QA/Dev config flags.

### `qa_flyway_migration`

| Parameter | Required | Example |
|-----------|----------|---------|
| `projects` | No | `["Orders_DB", "Billing_DB"]` |

Runs repair + migrate for QA on each project. Omit `projects` to run all discovered (respecting `FLYWAY_PROJECTS` env filter).

### `dev_flyway_migration`

Same parameters as QA, but uses `flyway_dev.toml`.

---

## 8. Migration flow (end to end)

### Per-project sequence

```
1. MCP client → tools/call qa_flyway_migration { projects?: [...] }
2. migrationTools.ts → migrationService.runEnvironmentMigration('qa', projects)
3. projectDiscovery.discoverProjects() → filter by env / args
4. For each project:
   a. assertEnvironmentConfig (QA or Dev toml exists)
   b. Loop up to FLYWAY_MAX_RETRIES:
      i.   flywayRunner.runRepair(projectPath, env)
      ii.  flywayRunner.runMigrate(projectPath, env)
      iii. If success → next project
      iv.  errorAnalyzer.analyzeFlywayOutput(output)
      v.   errorRemediator.applyRemediation(projectPath, error)
      vi.  Retry if remediation applied or checksum/failed_migration
5. formatMigrationSummary() → text report per project
6. Tool returns summary → MCP client → AI → user
```

### Flyway CLI invocation

From each project directory:

```
flyway -configFiles=flyway.toml,flyway_qa.toml repair
flyway -configFiles=flyway.toml,flyway_qa.toml migrate
```

(`flyway_dev.toml` for Development.)

---

## 9. Automatic error remediation

When migrate fails, the server analyzes output and may fix migration files before retrying.

| Error kind | Remediation |
|------------|-------------|
| **duplicate_version** | Renames duplicate migration file to next available version |
| **checksum_mismatch** | Retries after repair (no file edit) |
| **failed_migration** | Retries after repair |
| **placeholder_error** | Removes or replaces `${...}` placeholders in `.js` migrations |
| **missing_table** | Wraps table DDL in conditional `to_regclass` check in SQL |

If no remediation applies, the project is marked failed with Flyway output attached.

---

## 10. Project folder structure

```
flyway-mcp/
├── docs/
│   └── WIKI.md                    ← This document
├── src/
│   ├── index.ts                   ← MCP bootstrap
│   ├── env.ts                     ← Environment variable loader
│   ├── config/
│   │   └── flyway.config.ts       ← FW constants (messages, tools)
│   ├── interfaces/
│   │   └── flyway.ts              ← FlywayProject, MigrationSummary, etc.
│   ├── services/
│   │   ├── projectDiscovery.ts
│   │   ├── flywayRunner.ts
│   │   ├── migrationService.ts
│   │   ├── errorAnalyzer.ts
│   │   └── errorRemediator.ts
│   └── tools/
│       ├── index.ts               ← registerTools()
│       └── migrationTools.ts
├── dist/                          ← Compiled output (published to npm)
├── .env.example
├── LICENSE
├── package.json
├── tsconfig.json
└── README.md
```

---

## 11. Source code reference

### `src/index.ts`

- Creates `McpServer` with `FW.SERVER.NAME` / `VERSION`.
- Calls `validateEnv()` then `registerTools(server)`.
- Connects `StdioServerTransport`.

### `src/config/flyway.config.ts`

Single `FW` export (`as const`) containing:

- Server metadata
- Environment names (`qa`, `dev`)
- Config file names (`flyway.toml`, `flyway_qa.toml`, `flyway_dev.toml`)
- Tool names and descriptions
- User-facing error messages
- Env variable key aliases

### `src/env.ts`

Reads env using `FW.ENV.*_KEYS` arrays. Applies defaults for `FLYWAY_CLI` and `FLYWAY_MAX_RETRIES`.

### `src/services/projectDiscovery.ts`

`discoverProjects()` scans `FLYWAY_ROOT` and returns `FlywayProject[]`.

### `src/services/flywayRunner.ts`

Spawns Flyway CLI for `repair`, `migrate`, and `info`.

### `src/services/migrationService.ts`

Orchestrates the repair → migrate → analyze → remediate loop per project.

### `src/services/errorAnalyzer.ts` / `errorRemediator.ts`

Parse Flyway stderr/stdout and apply file-level fixes when possible.

### `src/tools/migrationTools.ts`

Registers `list_flyway_projects`, `qa_flyway_migration`, and `dev_flyway_migration`.

---

## 12. Environment variables

| Variable | Aliases | Required | Default |
|----------|---------|----------|---------|
| `FLYWAY_ROOT` | `flywayRoot` | **Yes** | — |
| `FLYWAY_CLI` | `flywayCli` | No | `flyway` |
| `FLYWAY_PROJECTS` | `flywayProjects` | No | — (all discovered) |
| `FLYWAY_MAX_RETRIES` | `flywayMaxRetries` | No | `3` |

For local `npm run dev`, copy `.env.example` to `.env` and set `FLYWAY_ROOT`.

---

## 13. Local development

```bash
git clone https://github.com/Mhdd-24/Flyway-MCP.git
cd Flyway-MCP
cp .env.example .env
# Edit .env — set FLYWAY_ROOT to your Flyway projects folder
npm install
npm run dev
```

Point Cursor MCP at the local build:

```json
{
  "mcpServers": {
    "flyway": {
      "command": "node",
      "args": ["C:/path/to/flyway-mcp/dist/index.js"],
      "env": {
        "FLYWAY_ROOT": "C:/path/to/your/Flyway"
      }
    }
  }
}
```

Or use `npm run dev` (tsx) during active development:

```json
"command": "npx",
"args": ["tsx", "C:/path/to/flyway-mcp/src/index.ts"]
```

---

## 14. Connecting MCP clients

### Cursor

`~/.cursor/mcp.json` or **Settings → MCP**:

```json
{
  "mcpServers": {
    "flyway": {
      "command": "npx",
      "args": ["-y", "@mhdd_24/flyway-mcp"],
      "env": {
        "FLYWAY_ROOT": "C:/path/to/your/Flyway",
        "FLYWAY_CLI": "flyway",
        "FLYWAY_MAX_RETRIES": "3"
      }
    }
  }
}
```

### Claude Desktop

Windows: `%APPDATA%\Claude\claude_desktop_config.json`  
macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

Same structure as Cursor.

---

## 15. Extending the project

### Add a new tool

1. Add tool metadata to `FW.TOOLS` in `src/config/flyway.config.ts`.
2. Create handler in `src/tools/` (or extend `migrationTools.ts`).
3. Register in `src/tools/index.ts`.
4. Document in README and this WIKI.

### Add a new remediation rule

1. Extend `analyzeFlywayOutput` in `errorAnalyzer.ts` with a new `FlywayError` kind.
2. Implement fix logic in `errorRemediator.ts`.
3. Update the retry branch in `migrationService.ts` if needed.

### Add a third environment (e.g. staging)

1. Add config file constant to `FW.CONFIG_FILES`.
2. Extend `FlywayEnvironment` type and discovery (`hasStaging` flag).
3. Add `staging_flyway_migration` tool mirroring QA/Dev.

---

## 16. Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| `FLYWAY_ROOT is not set` | Missing env in MCP config | Set `FLYWAY_ROOT` in MCP `env` |
| `No Flyway projects found` | Wrong path or missing config files | Verify folder has `flyway.toml` + `flyway_qa.toml` or `flyway_dev.toml` |
| `Missing flyway_qa.toml` | Project has only Dev config | Add QA config or run Dev migration instead |
| Flyway command fails immediately | CLI not on PATH | Install Flyway or set `FLYWAY_CLI` to full path |
| Java errors | JDK missing | Install Java and ensure `JAVA_HOME` is set |
| Migration fails after all retries | Unhandled error type | Read per-project output in tool response; fix migration manually |
| MCP shows old behavior | Cached npx package | Restart MCP; run `npx clear-npx-cache` if needed |

### Debug locally

```bash
npm run dev
```

Watch stderr for `Flyway MCP Server Started`. Test tools from Cursor with the local `node` / `tsx` command.

---

## 17. Publishing and post-release

### Pre-publish checklist

1. Bump `version` in `package.json`.
2. Bump `FW.SERVER.VERSION` in `src/config/flyway.config.ts`.
3. `npm run build` — verify `dist/` compiles cleanly.
4. Test with local MCP config against a real `FLYWAY_ROOT`.
5. Update README / WIKI if tools or env vars changed.

### Publish

```bash
npm login
npm publish --access public
```

`prepack` runs `npm run build` automatically.

### After publish

1. Tag release on GitHub (optional): `git tag v1.x.x && git push origin v1.x.x`
2. Users on `npx` get the latest on next MCP restart.
3. Global install users: `npm update -g @mhdd_24/flyway-mcp`

### GitHub Wiki

Copy or sync this `docs/WIKI.md` to the [GitHub Wiki](https://github.com/Mhdd-24/Flyway-MCP/wiki) for browser-friendly docs.

---

## License

ISC — see [LICENSE](../LICENSE) in the repository root.
