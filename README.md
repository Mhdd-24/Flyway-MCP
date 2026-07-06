# @mhdd_24/flyway-mcp

MCP server that runs **Flyway repair + migrate** across all RTS database projects for **QA** or **Development** environments. Use it from [Cursor](https://cursor.com) or any MCP-compatible client.

Say **"QA Flyway Migration"** or **"Dev Flyway Migration"** in chat — the assistant calls the matching tool automatically.

---

## Features

- Discovers all `SkAi_RTS_*` Flyway projects under `FLYWAY_ROOT`
- Runs `flyway repair` then `flyway migrate` per project
- **Automatic remediation** on common failures:
  - Duplicate migration version → renames duplicate files to next available version
  - Checksum mismatch / failed migration → retries after repair
  - Flyway placeholder errors in JS (`${dbName}`) → removes/replaces placeholders
  - Missing table (`relation does not exist`) → wraps table block in conditional `to_regclass` check

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 18+** | Required for MCP server |
| **Flyway CLI** | On PATH (`flyway -v` works) |
| **Java** | Required by Flyway |
| **FLYWAY_ROOT** | Path to `cargo_skai_DBscripts/Flyway` (or your Flyway projects folder) |

---

## Install

```bash
npm install -g @mhdd_24/flyway-mcp
```

Or use without global install:

```bash
npx @mhdd_24/flyway-mcp
```

---

## Configure Cursor MCP

Edit **Cursor Settings → MCP** or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "flyway": {
      "command": "npx",
      "args": ["-y", "@mhdd24/flyway-mcp"],
      "env": {
        "FLYWAY_ROOT": "C:\\codeBase\\cargo_skai_DBscripts\\Flyway",
        "FLYWAY_CLI": "flyway",
        "FLYWAY_MAX_RETRIES": "3"
      }
    }
  }
}
```

Optional: limit to specific projects:

```json
"FLYWAY_PROJECTS": "SkAi_RTS_Interfaces,SkAi_RTS_Transboard"
```

---

## MCP Tools

| Tool | Trigger phrase | Action |
|------|----------------|--------|
| `qa_flyway_migration` | **QA Flyway Migration** | repair + migrate all projects on QA (`flyway_qa.toml`) |
| `dev_flyway_migration` | **Dev Flyway Migration** | repair + migrate all projects on Dev (`flyway_dev.toml`) |
| `list_flyway_projects` | List flyway projects | Shows discovered projects and config availability |

### Optional parameters

- `projects` — array of project folder names to run (default: all)

---

## Local development

```bash
cd flyway-mcp
cp .env.example .env
# Edit .env with your FLYWAY_ROOT
npm install
npm run build
npm run dev
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FLYWAY_ROOT` | Yes | Root folder containing Flyway project directories |
| `FLYWAY_CLI` | No | Flyway executable (default: `flyway`) |
| `FLYWAY_PROJECTS` | No | Comma-separated project names to include |
| `FLYWAY_MAX_RETRIES` | No | Retry cycles per project (default: 3) |

---

## License

ISC
