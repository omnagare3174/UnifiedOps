# UnifiedOps v2 Agents Configuration

## Project Overview
UnifiedOps v2 (Hi-Track Alert v1.4.1) is an airgapped storage automation 
and monitoring solution designed to run across a 4-server topology on 
RHEL 9.4. The system ingests syslog UDP packets from storage arrays across 
three pipeline VMs (CDVL, BCP, SIFY) using Python listener scripts, and 
writes the telemetry data to a local InfluxDB instance on each node. A 
centralized UI VM hosts a Python FastAPI backend that proxies requests to 
the pipeline VMs and serves a React/Vite frontend dashboard, providing 
operators with real-time alerts pushed via WebSockets.

## Model Selection Rules

### Local Models (Privacy-Safe / Offline / Unlimited)
- **Default coding**: Use `qwen3-coder:30b` via @qwen for all general
  backend coding, API routes, FastAPI services, InfluxDB queries,
  WebSocket logic, and listener scripts.
- **Debugging / reasoning**: Use `deepseek-r1:14b` via @gemma for complex
  bug tracing, architectural decisions, data flow analysis across the
  4-server topology, and explaining why something is broken step by step.
- **Fast edits**: Use `qwen2.5-coder:1.5b` for single line fixes,
  renaming, formatting, minor syntax corrections.
- **Quick screenshots**: Use `moondream2` via @vision for fast UI
  screenshot analysis, reading dashboard images, describing interface
  elements. Lightweight and 4GB VRAM safe.
- **Deep image analysis**: Use `gemma3:4b` via @screenshot for detailed
  UI feedback, complex diagram reading, network topology images,
  SAN architecture drawings. 4GB VRAM safe.

### Antigravity Cloud Models (Primary Cloud Layer)
- **UI / Frontend**: Use Claude Sonnet 4.6 Thinking for all React
  components, TypeScript, Tailwind CSS, Zustand state, dashboard layout,
  and design system work.
- **Complex architecture**: Use Claude Opus 4.6 Thinking for large
  multi-file refactors, system design decisions, and when Sonnet is not
  producing good enough results. Use sparingly — it is slow.
- **Everyday tasks**: Use Gemini 3.5 Flash (High) for quick summaries,
  explanations, documentation, and anything that does not require deep
  coding or reasoning.
- **Browser / deploy**: Use Gemini 3.1 Pro (High) for browser subagent
  tasks, RHEL deployment validation, and Google Cloud integrations.

### NVIDIA NIM Free Models (Secondary Cloud Layer / Antigravity Credit Fallback)
Use when Antigravity cloud credits run low or models are unavailable.
NVIDIA NIM is cloud infrastructure — apply the same privacy rules as
Antigravity cloud. Never send private files or credentials to NIM.

- **nvidia-coder** (`qwen3-coder:480b`): Frontier coding fallback.
  Use when Claude Sonnet or Gemini runs out. Stronger than local 30b.
- **nvidia-reason** (`deepseek-r1:671b`): Full R1 reasoning — not a
  distillation. Far stronger than local 14b. Use when Claude Opus runs out.
- **nvidia-fast** (`minimax-m2.7`): 230B sparse MoE, strong all-round.
  Use when Gemini Flash runs out for general tasks.
- **nvidia-context** (`deepseek-v4-flash`): 1M context window. Use for
  large codebase analysis, whole-repo tasks, 700-page vendor PDFs, or
  files too large for other models.
- **nvidia-vision** (`gemma4:e4b`): Cloud vision model. Use for complex
  diagrams, network topology images, SAN architecture drawings, detailed
  UI analysis when local vision models are insufficient.
- **nvidia-embed** (`nv-embedqa-e5-v5`): Embedding model for RAG
  pipeline. Use when building search over vendor manuals (Hitachi,
  NetApp, Brocade, Dell documentation).

### Fallback Chain (try each level before moving to next)

| Need | Level 1 Primary | Level 2 NIM Free | Level 3 Local |
|---|---|---|---|
| UI / Frontend | Claude Sonnet 4.6 | nvidia-coder (480b) | @screenshot (gemma3:4b) |
| Architecture / reasoning | Claude Opus 4.6 | nvidia-reason (671b) | @gemma (14b) |
| General coding | @qwen local (primary) | nvidia-coder (480b) | nvidia-fast |
| Everyday tasks | Gemini 3.5 Flash | nvidia-fast (m2.7) | @qwen local |
| Large context / whole repo | nvidia-context (1M) | @gemma local | — |
| Vendor PDF / RAG | nvidia-context (1M) | nvidia-embed + @qwen | local RAG |
| Cloud vision / diagrams | nvidia-vision (gemma4) | @screenshot (gemma3:4b) | @vision (moondream2) |
| Quick screenshots | @vision (moondream2) | @screenshot (gemma3:4b) | — |
| All cloud down | — | — | Full local only |
| Private / credentials | Local only — never cloud | Never NIM | @qwen / @gemma |

## Security Rules
- **NEVER use cloud models (Antigravity OR NVIDIA NIM) for**:
  - Files inside `private\` directory
  - InfluxDB tokens, self-signed TLS certificates, API keys
  - Any `.env` files or secrets configs
  - Deployment scripts containing server IPs or credentials
  - RHEL server usernames, passwords, or SSH keys
  - FC/SAN zone configs, LUN mappings, RAID group data
  - SNMP community strings or array management credentials
- **NVIDIA NIM runs on cloud infrastructure** — treat it identically to
  Antigravity cloud for all privacy decisions.
- **Always use local models (@qwen or @gemma) for the above** —
  these never leave your machine.

## Project-Specific Agent Rules

### Backend (Python)
- Write Python 3.9 compatible code only
- Use `from __future__ import annotations` at top of every file
- Use explicit typing: `Dict`, `List`, `Optional`, `Tuple` — not `dict`,
  `list` etc.
- Respect existing FastAPI patterns: `ThreadPoolExecutor` for InfluxDB
  connections and `WsHub` for WebSocket management
- Never introduce new dependencies without asking first — this is an
  airgapped system, adding packages requires offline RPM/wheel bundling

### Frontend (React)
- Write React 19 functional components with TypeScript only
- Use Vite as the build tool — no CRA or Next.js
- Use Zustand for state management when global state is needed
- Use Tailwind CSS for all styling — no inline styles, no CSS modules
- Use `@tanstack/react-table` for all data grids
- Use Claude Sonnet 4.6 Thinking for all frontend work
- Fall back to nvidia-coder if Sonnet credits run out
- Fall back to @screenshot (gemma3:4b) if all cloud is unavailable

### Syslog Listeners
- Each listener script must remain fully self-contained per location
- No cross-location imports: `_cdvl`, `_bcp`, `_sify` are isolated
- Follow the existing environment allowlist design strictly
- Never refactor a single listener in a way that creates shared
  cross-location dependencies

### Deployment
- All deployment scripts must target RHEL 9.4 offline installation
- Use RPMs and Python wheels — no live pip install or yum with internet
- Scripts are written in PowerShell on Windows but execute on RHEL
- Always test PowerShell to RHEL path compatibility before committing
- Never assume internet access on target servers
- Always use @qwen for deployment scripts — never any cloud model

## Task-to-Model Quick Reference

| Task | Primary | Fallback 1 | Fallback 2 |
|---|---|---|---|
| FastAPI route / endpoint | @qwen (qwen3-coder:30b) | nvidia-coder (480b) | — |
| InfluxDB query / schema | @qwen (qwen3-coder:30b) | nvidia-coder (480b) | — |
| WebSocket / WsHub logic | @qwen (qwen3-coder:30b) | nvidia-coder (480b) | — |
| Syslog listener changes | @qwen (local only) | — never cloud — | — |
| Bug trace / data flow | @gemma (deepseek-r1:14b) | nvidia-reason (671b) | — |
| Architecture decision | @gemma (deepseek-r1:14b) | nvidia-reason (671b) | — |
| React component / UI | Claude Sonnet 4.6 Thinking | nvidia-coder (480b) | @screenshot |
| Dashboard layout / CSS | Claude Sonnet 4.6 Thinking | nvidia-coder (480b) | @screenshot |
| Tailwind styling | Claude Sonnet 4.6 Thinking | nvidia-coder (480b) | @screenshot |
| Zustand store | Claude Sonnet 4.6 Thinking | nvidia-coder (480b) | @screenshot |
| TanStack table / grid | Claude Sonnet 4.6 Thinking | nvidia-coder (480b) | @screenshot |
| Large multi-file refactor | Claude Opus 4.6 Thinking | nvidia-reason (671b) | @gemma |
| System design decision | Claude Opus 4.6 Thinking | nvidia-reason (671b) | @gemma |
| Whole repo / large context | nvidia-context (v4-flash) | @gemma (14b) | — |
| Vendor PDF / 700 pages | nvidia-context (v4-flash) | local RAG + @qwen | — |
| RAG embeddings | nvidia-embed (nv-embedqa) | nomic-embed-text local | — |
| Docs / summaries | Gemini 3.5 Flash (High) | nvidia-fast (m2.7) | @qwen |
| Network / SAN diagrams | nvidia-vision (gemma4:e4b) | @screenshot (gemma3:4b) | — |
| Quick UI screenshots | @vision (moondream2) | @screenshot (gemma3:4b) | — |
| Deep image analysis | @screenshot (gemma3:4b) | nvidia-vision (gemma4) | — |
| RHEL deploy scripts | @qwen (local only) | — never cloud — | — |
| Private / credentials | @qwen or @gemma only | — never cloud — | — |

## Git Rules
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Commit after every completed task
- Never commit files from `private\` directory
- Add `private\` to `.gitignore` if not already there