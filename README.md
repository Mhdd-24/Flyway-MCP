# @mhdd_24/flyway-mcp

MCP server that runs **Flyway repair + migrate** across multiple database projects for **QA** or **Development** environments. Use it from [Cursor](https://cursor.com), Claude Desktop, VS Code Copilot, or any MCP-compatible client.

Say **"QA Flyway Migration"** or **"Dev Flyway Migration"** in chat — the assistant calls the matching tool automatically.

**Full documentation:** [docs/WIKI.md](./docs/WIKI.md) · [GitHub Wiki](https://github.com/Mhdd-24/Flyway-MCP/wiki)

---

## How it works (30 seconds)

```
You (chat) → MCP client → flyway-mcp → discover projects under FLYWAY_ROOT
                                     → flyway repair + migrate per project
                                     → auto-fix common migration errors (retry)
```

1. **Discovery** scans `FLYWAY_ROOT` for folders with `flyway.toml` plus `flyway_qa.toml` or `flyway_dev.toml`
2. **`qa_flyway_migration`** / **`dev_flyway_migration`** run repair then migrate per project
3. On failure, the server **remediates** when possible (duplicate versions, checksum mismatches, placeholder errors, missing tables) and retries
4. **`list_flyway_projects`** shows discovered projects and which environment configs exist

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 18+** | Uses native `fetch` and child processes |
| **Flyway CLI** | On PATH (`flyway -v` works) |
| **Java** | Required by Flyway |
| **FLYWAY_ROOT** | Path to the folder containing your Flyway project directories |

---

## Install

### Option A — npm (recommended after publish)

```bash
npm install -g @mhdd_24/flyway-mcp
```

This installs the `flyway-mcp` CLI and compiles `dist/` via the package `prepack` script.

### Option B — npx (no global install)

```bash
npx @mhdd_24/flyway-mcp
```

Downloads and runs the latest published version on each invocation.

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
        "FLYWAY_ROOT": "C:/path/to/your/Flyway",
        "FLYWAY_CLI": "flyway",
        "FLYWAY_MAX_RETRIES": "3"
      }
    }
  }
}
```

**After global install**, you can use:

```json
"command": "flyway-mcp"
```

**Local development:**

```json
"command": "node",
"args": ["C:/path/to/flyway-mcp/dist/index.js"]
```

Restart Cursor (or toggle the MCP server off/on) after saving.

### Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

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

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FLYWAY_ROOT` | Yes | — | Root folder containing Flyway project directories |
| `FLYWAY_CLI` | No | `flyway` | Flyway executable (PATH or full path) |
| `FLYWAY_PROJECTS` | No | — | Comma-separated project folder names to include |
| `FLYWAY_MAX_RETRIES` | No | `3` | Repair/migrate/remediate retry cycles per project |

**Aliases:** `flywayRoot`, `flywayCli`, `flywayProjects`, `flywayMaxRetries` (see [WIKI](./docs/WIKI.md#11-environment-variables)).

**Never commit** database credentials. Flyway connection settings belong in each project's `flyway_*.toml` files.

---

## Tools

| Tool | Trigger phrase | Action |
|------|----------------|--------|
| `list_flyway_projects` | List flyway projects | Shows discovered projects and QA/Dev config availability |
| `qa_flyway_migration` | **QA Flyway Migration** | repair + migrate all projects using `flyway_qa.toml` |
| `dev_flyway_migration` | **Dev Flyway Migration** | repair + migrate all projects using `flyway_dev.toml` |

### Optional parameters

- `projects` — array of project folder names to run (default: all discovered)

---

## Usage

### Step 1 — List projects (optional)

In chat:

> Use flyway **list_flyway_projects**.

Expected: project names with QA/Dev config flags and paths.

### Step 2 — Run migrations

> Run **QA Flyway Migration**.

> Run **Dev Flyway Migration** for projects `MyService_DB` and `Billing_DB`.

The server returns a per-project summary with success/failure, remediations applied, and Flyway output.

---

## What happens after `npm install`?

1. Package files land in `node_modules/@mhdd_24/flyway-mcp/` (or global prefix if `-g`).
2. `prepack` / publish includes compiled **`dist/`** — no local build needed for end users.
3. The **`flyway-mcp`** bin points to `dist/index.js`.
4. Your MCP client runs that entry over **stdio** (stdin/stdout = MCP protocol; logs go to stderr).
5. On startup: `validateEnv()` warns if `FLYWAY_ROOT` is missing.
6. Tools are registered; the server waits for `CallTool` requests from the AI.

---

## After publishing to npm (maintainers)

1. **Bump version** in `package.json` and `src/config/flyway.config.ts` (`FW.SERVER.VERSION`).
2. **Build and test:** `npm run build` then test with local `mcp.json`.
3. **Publish:** `npm publish --access public` (logged in as package owner).
4. **Users update** by restarting MCP — `npx` picks up the new version automatically.
5. **Global install users:** `npm update -g @mhdd_24/flyway-mcp`.

See [WIKI — Publishing](./docs/WIKI.md#17-publishing-and-post-release) for the full checklist.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| MCP server won't start | Set `FLYWAY_ROOT` in MCP `env` |
| No projects found | Ensure each project has `flyway.toml` and `flyway_qa.toml` or `flyway_dev.toml` |
| Flyway CLI not found | Install Flyway, set `FLYWAY_CLI` to full path if needed |
| Migration keeps failing | Check per-project output in the tool response; increase `FLYWAY_MAX_RETRIES` |
| Stale version after publish | Restart MCP; `npx` uses latest unless pinned |

More detail: [docs/WIKI.md § Troubleshooting](./docs/WIKI.md#16-troubleshooting).

---

## License

ISC
