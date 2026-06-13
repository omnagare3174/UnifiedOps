# UnifiedOps v2 AI Coding Assistant Guidelines

## System Context (Windows)
- **OS**: Windows 11, Terminal: PowerShell (pwsh) only
- **Username**: abhim
- **Python command**: Use `python` not `python3`
- **Paths**: Always use backslashes in file paths
- **Never use Unix commands** — use PowerShell equivalents only:
  - `New-Item` not `touch`
  - `Get-ChildItem` not `ls`
  - `Get-Content` not `cat`
  - `Remove-Item` not `rm`
  - `Copy-Item` not `cp`
  - `Move-Item` not `mv`
- **Virtual environments**: Always use `.venv`
  - Create:   `python -m venv .venv`
  - Activate: `.venv\Scripts\Activate.ps1`
  - Install:  `.venv\Scripts\pip.exe install ...`

## Language and Framework Preferences
- **Backend**: Python 3.9+, FastAPI, Uvicorn, HTTPX, WebSockets
- **Database**: InfluxDB v2 using `influxdb-client`
- **Frontend**: React 19, TypeScript, Vite, Zustand, `@tanstack/react-table`
- **Deployment target**: RHEL 9.4, airgapped (no internet on target servers)

## Folder Structure Rules
- `server/`   — FastAPI routers, services, server initialization logic
- `listener/` — Location-specific syslog listener scripts
  (`syslog_trap_listener_cdvl.py`, `_bcp.py`, `_sify.py`)
- `frontend/` — React components, Vite config, frontend assets
- `scripts/`  — Deployment, build, and utility PowerShell scripts
- `deploy/`   — Deployment instructions, TLS setup, InfluxDB setup scripts
- `private/`  — Credentials, tokens, certs — NEVER committed to git
- `docs/`     — Vendor manuals, RAG source files, runbooks

When creating new files always ask: which folder does this belong in?
Never create files outside the project root.

## Coding Style Rules

### Python
- Follow PEP 8 strictly
- Always use `from __future__ import annotations` at top of every file
- Always use explicit typing: `Dict`, `List`, `Optional`, `Tuple`, `Any`
  from `typing` — never use `dict`, `list` etc. directly (Python 3.9)
- Use `asyncio` for all FastAPI routes and WebSocket handlers
- Use `ThreadPoolExecutor` for all blocking InfluxDB calls
- Use `WsHub` class pattern for all WebSocket management

### React / TypeScript
- Modern React 19 functional components only — no class components
- Strict TypeScript types on all props, state, and function signatures
- No `any` type unless absolutely unavoidable
- Use Zustand stores for all shared/global state
- Use `@tanstack/react-table` for all data grids and tables
- Tailwind CSS only — no inline styles, no CSS modules

### Listeners
- Keep listener scripts flat and self-contained per location
- No imports that cross-contaminate `_cdvl`, `_bcp`, `_sify` logic
- Do not add complex abstractions — listeners must be readable standalone

## NVIDIA NIM Usage Rules
- NVIDIA NIM (`integrate.api.nvidia.com`) is cloud infrastructure
- Apply same privacy rules as Antigravity cloud for all NIM requests:
  - Never send `private\` files to NIM
  - Never send credentials, tokens, IPs, or `.env` content to NIM
  - Never send SAN configs, LUN mappings, or array credentials to NIM
  - NIM is for coding and reasoning tasks only
- Available NIM providers in this project:
  - `nvidia-coder`   — qwen3-coder:480b    — frontier coding fallback
  - `nvidia-reason`  — deepseek-r1:671b    — deep reasoning fallback
  - `nvidia-fast`    — minimax-m2.7        — general tasks fallback
  - `nvidia-context` — deepseek-v4-flash   — 1M context, large files/PDFs
  - `nvidia-vision`  — gemma4:e4b          — cloud vision, diagrams
  - `nvidia-embed`   — nv-embedqa-e5-v5    — RAG embeddings for vendor docs

## RAG / PDF Workflow
- Use `nvidia-context` (deepseek-v4-flash) for one-off large PDF queries
- For repeated vendor doc queries, build local RAG:
  - Extract with: `pymupdf`
  - Embed with: `nvidia-embed` or local `nomic-embed-text`
  - Store in: `chromadb`
  - Query results passed to: `@qwen` or `@gemma`
- Store vendor PDFs in `docs/` folder — never in `private\`

## What NOT to Auto-Run
- **Tests**: Do NOT run unit or integration tests automatically
- **Deployments**: Do NOT run installation scripts or systemd units
  without explicit permission
- **Database**: Do NOT run InfluxDB setup or any data operations
- **Packages**: Do NOT install new packages without asking — airgapped
  system requires offline RPM/wheel bundling
- **Bulk edits**: Always show a diff or file list before editing
  multiple files at once
- **Outside project root**: Never create or modify files outside
  the project root directory

## Git Commit Conventions
Always use conventional commits:

- `feat:`     — new features     (`feat: add BCP listener support`)
- `fix:`      — bug fixes        (`fix: resolve websocket connection drop`)
- `refactor:` — restructuring    (`refactor: extract influx pool to service`)
- `docs:`     — documentation    (`docs: update INSTALL.md with TLS matrix`)
- `chore:`    — maintenance      (`chore: update .gitignore for private dir`)

**Always commit after completing every task.**
**Never commit files from `private\` directory.**
**Verify `private\` is in `.gitignore` before first commit.**