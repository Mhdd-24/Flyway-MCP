# Flyway MCP — Project Wiki

Complete guide for **@mhdd_24/flyway-mcp**: what it does, how it works, setup, daily usage, and maintainer workflow.

---

## Table of contents

1. [What this project does](#1-what-this-project-does)
2. [High-level architecture](#2-high-level-architecture)
3. [Complete setup for a new user](#3-complete-setup-for-a-new-user)
4. [Configuration reference](#4-configuration-reference)
5. [Using the MCP tools](#5-using-the-mcp-tools)
6. [Automatic remediation](#6-automatic-remediation)
7. [Request flow (end to end)](#7-request-flow-end-to-end)
8. [Project folder structure](#8-project-folder-structure)
9. [Source code reference](#9-source-code-reference)
10. [Local development](#10-local-development)
11. [Connecting MCP clients](#11-connecting-mcp-clients)
12. [Troubleshooting](#12-troubleshooting)
13. [Publishing and post-release](#13-publishing-and-post-release)

---

## 1. What this project does

**flyway-mcp** is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server. It lets AI assistants run **Flyway database migrations** across multiple projects using natural language.

Example prompts:

> QA Flyway Migration

> Dev Flyway Migration for payments-db

The server exposes three tools:

| Tool | Role |
|------|------|
| `list_flyway_projects` | Discover projects under `FLYWAY_ROOT` |
| `qa_flyway_migration` | `repair` + `migrate` on QA (`flyway_qa.toml`) |
| `dev_flyway_migration` | `repair` + `migrate` on Dev (`flyway_dev.toml`) |

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MCP client (Cursor, Claude Desktop, VS Code, …)                 │
│  stdio JSON-RPC — tools/list, tools/call                         │
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
│ projectDiscovery│ │ flywayRunner    │ │ errorAnalyzer +           │
│ (scan FLYWAY_   │ │ spawn flyway    │ │ errorRemediator           │
│  ROOT)          │ │ repair/migrate  │ │ fix + retry loop          │
└─────────────────┘ └─────────────────┘ └─────────────────────────┘
```

### Layer responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| **Entry** | `src/index.ts` | Boot MCP server, validate env, register tools |
| **Config** | `src/config/flyway.config.ts` | Constants (`FW`) — messages, tool metadata |
| **Interfaces** | `src/interfaces/` | TypeScript contracts (`project`, `migration`, `error`) |
| **Tools** | `src/tools/` | One MCP tool per file + shared registration helper |
| **Services** | `src/services/` | Discovery, CLI runner, migration orchestration, remediation |
| **Utils** | `src/utils/` | MCP responses, output truncation, migration file helpers |
| **Env** | `src/env.ts` | Read `process.env` with aliases |

---

## 3. Complete setup for a new user

### Step 1 — Install prerequisites

1. Install **Node.js 18+**
2. Install **Java** and **Flyway CLI** (`flyway -v` works in terminal)
3. Organize Flyway projects under one root folder

### Step 2 — Install the MCP package

```bash
npm install -g @mhdd_24/flyway-mcp
```

Or use `npx @mhdd_24/flyway-mcp` without global install.

### Step 3 — Configure MCP client

Add to Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "flyway": {
      "command": "npx",
      "args": ["-y", "@mhdd_24/flyway-mcp"],
      "env": {
        "FLYWAY_ROOT": "/path/to/your/flyway-projects",
        "FLYWAY_CLI": "flyway",
        "FLYWAY_MAX_RETRIES": "3"
      }
    }
  }
}
```

### Step 4 — Verify

In chat:

> List flyway projects

Expected: list of project folders with QA/Dev config flags.

---

## 4. Configuration reference

### Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FLYWAY_ROOT` | Yes | — | Root containing Flyway project subfolders |
| `FLYWAY_CLI` | No | `flyway` | CLI executable |
| `FLYWAY_PROJECTS` | No | all | Comma-separated filter |
| `FLYWAY_MAX_RETRIES` | No | `3` | Retries per project |

### Per-project Flyway config

Each project should have:

| File | Purpose |
|------|---------|
| `flyway.toml` | Base Flyway settings |
| `flyway_qa.toml` | QA database URL + `environment="qa"` |
| `flyway_dev.toml` | Dev database URL + `environment="dev"` |

The MCP server runs:

```bash
flyway -configFiles=flyway.toml,flyway_qa.toml repair
flyway -configFiles=flyway.toml,flyway_qa.toml -skipExecutingMigrations=false migrate
```

(On Windows, the command is executed as a single shell line for compatibility.)

### Never skip-execute migrations

`skipExecutingMigrations=true` is **forbidden**. It records versions in `flyway_schema_history` with `execution_time = 0` **without running scripts**, so seed/data migrations (and DDL) never apply.

- MCP migrate always forces `-skipExecutingMigrations=false` and fails if skip-execution is detected in output.
- Each project `flyway.toml` should set `skipExecutingMigrations = false`.
- If migrate fails because objects already exist, make the script idempotent and re-run — do not mark history without execute.

---

## 5. Using the MCP tools

### `list_flyway_projects`

No parameters. Returns all discovered projects and whether QA/Dev configs exist.

### `qa_flyway_migration`

| Parameter | Type | Description |
|-----------|------|-------------|
| `projects` | `string[]` (optional) | Subset of project folder names |

Natural language: **"QA Flyway Migration"**

### `dev_flyway_migration`

Same parameters as QA. Natural language: **"Dev Flyway Migration"**

---

## 6. Automatic remediation

For each project, the migration loop:

1. `flyway repair`
2. `flyway migrate`
3. On failure → analyze output → apply fix → retry (up to `FLYWAY_MAX_RETRIES`)

| Error pattern | Remediation |
|---------------|-------------|
| Duplicate version | Rename duplicate migration files to next free version |
| Checksum mismatch | Retry after repair |
| `${placeholder}` in JS | Remove/replace placeholder usage |
| `relation "x.y" does not exist` | Wrap table section in `to_regclass` conditional |

Errors that require manual intervention (e.g. missing Flyway database plugin) are reported in the summary.

---

## 7. Request flow (end to end)

1. User says **"QA Flyway Migration"** in chat
2. MCP client calls `qa_flyway_migration`
3. Server reads `FLYWAY_ROOT`, discovers projects
4. For each project:
   - Validate `flyway_qa.toml` exists
   - Run repair → migrate loop with remediation
5. Returns markdown summary: success/fail per project, remediations applied, Flyway output

---

## 8. Project folder structure

```
flyway-mcp/
├── src/
│   ├── index.ts
│   ├── env.ts
│   ├── config/
│   │   └── flyway.config.ts
│   ├── interfaces/
│   │   ├── project.ts
│   │   ├── migration.ts
│   │   └── error.ts
│   ├── utils/
│   │   ├── toolResponse.ts
│   │   ├── output.ts
│   │   ├── migrationFiles.ts
│   │   └── fs.ts
│   ├── services/
│   │   ├── projectDiscovery.ts
│   │   ├── flywayRunner.ts
│   │   ├── migrationService.ts
│   │   ├── errorAnalyzer.ts
│   │   └── errorRemediator.ts
│   └── tools/
│       ├── index.ts
│       ├── listFlywayProjectsTool.ts
│       ├── qaFlywayMigrationTool.ts
│       ├── devFlywayMigrationTool.ts
│       └── registerEnvironmentMigrationTool.ts
├── docs/WIKI.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 9. Source code reference

| File | Purpose |
|------|---------|
| `projectDiscovery.ts` | Scan `FLYWAY_ROOT` for valid Flyway projects |
| `flywayRunner.ts` | Spawn Flyway CLI (Windows-safe) |
| `migrationService.ts` | Orchestrate repair/migrate/retry per project |
| `errorAnalyzer.ts` | Parse Flyway stderr for known patterns |
| `errorRemediator.ts` | Apply file-level fixes when possible |
| `listFlywayProjectsTool.ts` | MCP tool — list discovered projects |
| `qaFlywayMigrationTool.ts` | MCP tool — QA migration entry point |
| `devFlywayMigrationTool.ts` | MCP tool — Dev migration entry point |
| `registerEnvironmentMigrationTool.ts` | Shared migration tool handler |
| `utils/toolResponse.ts` | MCP success/error response helpers |
| `utils/migrationFiles.ts` | Migration file discovery and versioning helpers |
| `utils/output.ts` | Truncate long Flyway CLI output |
| `utils/fs.ts` | Filesystem helpers |

---

## 10. Local development

```bash
git clone https://github.com/Mhdd-24/Flyway-MCP.git
cd Flyway-MCP
cp .env.example .env
# Edit .env — set FLYWAY_ROOT
npm install
npm run dev
```

Point Cursor MCP at `node dist/index.js` for local testing.

---

## 11. Connecting MCP clients

### Cursor

`~/.cursor/mcp.json` — see [README](./README.md#configure-your-mcp-client).

### Claude Desktop

`claude_desktop_config.json` — same `mcpServers` block structure.

---

## 12. Troubleshooting

| Problem | Fix |
|---------|-----|
| MCP won't start | Ensure Node 18+; check `FLYWAY_ROOT` |
| No projects found | Each subfolder needs `flyway.toml` |
| Windows `Invalid flag: -configFiles` | Use v1.0.1+ (single-line shell command) |
| `ENOENT` rename under user home (`C:\Users\…\migrations\…`) | Fixed in **v1.0.3** — relative offender paths resolve under `FLYWAY_ROOT/<project>` (e.g. `C:\codeBase\cargo_skai_DBscripts\Flyway\SkAi_RTS_App_Configuration`) |
| Duplicate version auto-rename uses wrong folder | Same as above — use MCP package **≥ 1.0.3** |
| Trino/other DB fails | Install Flyway plugin for that database |
| `repeatables/qa not found` | Harmless — create folder or remove from `flyway_qa.toml` |
| Schema newer than local scripts | Pull missing migration files; Flyway will not re-run already-applied versions |
| Edited an already-applied script | `repair` updates checksum only — re-run SQL manually or add a new `V{n+1}` |

---

## 13. Publishing and post-release

1. Bump version in `package.json` and `src/config/flyway.config.ts` (`FW.SERVER.VERSION`)
2. `npm run build` and test locally
3. `npm publish --access public`
4. Users restart MCP — `npx` picks up latest version

---

## License

ISC
