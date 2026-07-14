# @mhdd_24/flyway-mcp

MCP server that runs **Flyway repair + migrate** across multiple database projects for **QA** or **Development** environments. Use it from [Cursor](https://cursor.com), Claude Desktop, VS Code Copilot, or any MCP-compatible client.

Say **"QA Flyway Migration"** or **"Dev Flyway Migration"** in chat — the assistant calls the matching tool automatically.

**Full documentation:** [docs/WIKI.md](./docs/WIKI.md)

---

## How it works (30 seconds)

```
You (chat) → MCP client → flyway-mcp → discover projects under FLYWAY_ROOT
                                    → flyway repair + migrate (per project)
                                    → auto-remediate common errors → retry
```

1. **Discovery** — finds subfolders with `flyway.toml` and `flyway_qa.toml` / `flyway_dev.toml`
2. **Repair** — fixes schema history checksums before migrate
3. **Migrate** — applies pending migrations per environment config
4. **Remediation** — on failure, attempts automatic fixes (duplicate versions, placeholders, missing tables) and retries

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 18+** | Required for MCP server |
| **Flyway CLI** | On PATH (`flyway -v` works) |
| **Java** | Required by Flyway |
| **FLYWAY_ROOT** | Path to folder containing your Flyway project directories |

### Expected project layout

Each project is a subfolder under `FLYWAY_ROOT`:

```
flyway-projects/
├── service-a-db/
│   ├── flyway.toml
│   ├── flyway_qa.toml
│   ├── flyway_dev.toml
│   └── migrations/
└── service-b-db/
    ├── flyway.toml
    └── migrations/
```

---

## Install

### Option A — npm (recommended)

```bash
npm install -g @mhdd_24/flyway-mcp
```

### Option B — npx (no global install)

```bash
npx @mhdd_24/flyway-mcp
```

### Option C — clone and build (contributors)

```bash
git clone https://github.com/Mhdd-24/Flyway-MCP.git
cd Flyway-MCP
npm install
npm run build
node dist/index.js
```

---

## Configure your MCP client

### Cursor

Edit **Cursor Settings → MCP** or `~/.cursor/mcp.json`:

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

**After global install:**

```json
"command": "flyway-mcp"
```

**Local development:**

```json
"command": "node",
"args": ["C:/path/to/flyway-mcp/dist/index.js"]
```

Restart Cursor after saving.

### Optional: limit projects

```json
"FLYWAY_PROJECTS": "service-a-db,service-b-db"
```

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FLYWAY_ROOT` | Yes | — | Root folder containing Flyway project directories |
| `FLYWAY_CLI` | No | `flyway` | Flyway executable name or path |
| `FLYWAY_PROJECTS` | No | all | Comma-separated project folder names to include |
| `FLYWAY_MAX_RETRIES` | No | `3` | Repair/migrate/fix retry cycles per project |

**Never commit** database credentials. Keep connection strings in `flyway_qa.toml` / `flyway_dev.toml` inside each project (not in MCP env).

---

## Tools

| Tool | Trigger phrase | Purpose |
|------|----------------|---------|
| `list_flyway_projects` | List flyway projects | Shows discovered projects and QA/Dev config availability |
| `qa_flyway_migration` | **QA Flyway Migration** | `repair` + `migrate` using `flyway_qa.toml` |
| `dev_flyway_migration` | **Dev Flyway Migration** | `repair` + `migrate` using `flyway_dev.toml` |

### Optional parameters

| Parameter | Applies to | Description |
|-----------|------------|-------------|
| `projects` | migration tools | Array of project folder names (default: all discovered) |

---

## Usage

### List projects

> List flyway projects

### QA migration (all projects)

> QA Flyway Migration

### Dev migration (single project)

> Dev Flyway Migration for service-a-db

---

## Automatic remediation

On migration failure, the server may automatically:

| Error | Fix |
|-------|-----|
| Duplicate migration version | Renames duplicate files to next available version |
| Checksum mismatch | Runs `repair` and retries |
| JS placeholder (`${dbName}`) | Removes/replaces Flyway placeholder tokens |
| Missing table (`relation does not exist`) | Wraps table block in conditional `to_regclass` check |

Some errors (e.g. missing database plugins) cannot be auto-fixed and are reported in the summary.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `FLYWAY_ROOT is not set` | Set `FLYWAY_ROOT` in MCP `env` |
| `Invalid flag: -configFiles` (Windows) | Upgrade to `@mhdd_24/flyway-mcp@1.0.1`+ |
| `ENOENT` rename under `C:\Users\…\migrations\…` | Upgrade to **1.0.3+** — paths resolve under `FLYWAY_ROOT/<project>` |
| `No Flyway projects found` | Ensure subfolders contain `flyway.toml` |
| `No Flyway database plugin` | Install the Flyway plugin for that database type |
| Edited already-applied migration does nothing | Expected — add a new version or run SQL manually after `repair` |
| Stale version after publish | Restart MCP; `npx` uses latest unless pinned |

More detail: [docs/WIKI.md](./docs/WIKI.md)

---

## License

ISC
