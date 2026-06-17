# agents-md

> A README, but for AI agents. Scan a repo and generate a high-quality `AGENTS.md` that tells AI coding agents how to work in your project.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

`AGENTS.md` is an emerging convention for telling AI coding agents — Cursor, Claude Code, GitHub Copilot, OpenClaw, Hermes, Codex, and others — how to build, test, and contribute in a repository. `agents-md` looks at your project and writes a clean, accurate first draft for you in seconds.

## Why

Every AI agent that touches your codebase asks the same questions: What stack is this? How do I install it? How do I run the tests? What conventions should I follow? Today that context is scattered across the README, CI config, and the maintainers' heads — so agents guess, and guess wrong.

`agents-md` reads the signals already in your repo (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, lockfiles, scripts, directory layout) and produces a structured `AGENTS.md` grounded in those facts. It only writes sections it has real data for — it never invents commands or makes up a stack.

## Quick start

No install required:

```bash
npx agentsmd
```

Or run it in any project directory:

```bash
# Scan the current directory and write AGENTS.md
npx agentsmd

# Preview without writing a file
npx agentsmd --stdout

# Scan a specific path
npx agentsmd ./packages/api
```

Install it globally if you use it often:

```bash
npm install -g agentsmd
agentsmd --help
```

> The npm package and installed command are both `agentsmd` (the hyphenated `agents-md` was already taken on npm). The GitHub repo is `BitmapAsset/agents-md`.

## Example

Running `agents-md` in a TypeScript project produces something like:

```markdown
# AGENTS.md — sample-widget

Guidance for AI coding agents (Cursor, Claude Code, Copilot, OpenClaw, Hermes, Codex, and others) working in
this repository. Treat it as the source of truth for how to build, test, and
contribute here.

## Project overview

A sample widget library.

- **Language:** TypeScript, JavaScript
- **Stack:** Express, Vitest
- **Package manager:** pnpm
- **Node:** >=18
- **License:** MIT

## Setup

Install dependencies:

\`\`\`bash
pnpm install
\`\`\`

## Build & run

\`\`\`bash
pnpm build
pnpm dev
\`\`\`

## Test

\`\`\`bash
pnpm test
\`\`\`

## Do / Don't

**Do**

- Run `pnpm test` and ensure it passes before finishing.

**Don't**

- Use a different package manager than `pnpm` or commit a foreign lockfile.
```

It is a first draft, not a final answer: review it and add project-specific context an agent could not infer.

## Options

| Option              | Description                                                       | Default     |
| ------------------- | ----------------------------------------------------------------- | ----------- |
| `[path]`            | Directory to scan                                                 | `.`         |
| `-o, --output <p>`  | Output file path                                                  | `AGENTS.md` |
| `--stdout`          | Print to stdout instead of writing a file                         | off         |
| `-f, --force`       | Overwrite an existing output file                                 | off         |
| `--dry-run`         | Show what would be written without writing it                     | off         |
| `-h, --help`        | Show help                                                         | —           |
| `-v, --version`     | Show the version                                                  | —           |

If `AGENTS.md` already exists and `--force` is not set, `agents-md` warns and exits without overwriting it.

## What it detects

| Area              | Sources                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| Language / stack  | `package.json`, `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml` |
| Package manager   | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`          |
| Commands          | `package.json` scripts, plus ecosystem defaults (pytest, go, cargo)      |
| Frameworks        | Dependency names (Next.js, React, Express, FastAPI, Django, and more)    |
| Monorepo          | `workspaces` field and `pnpm-workspace.yaml`                             |
| Structure         | Common directories (`src`, `test`, `docs`, `packages`, …)                |
| License           | `package.json` / manifest metadata, or a `LICENSE` file                  |

## How it works

`agents-md` runs in two read-only passes:

1. **Detect** — walk the target directory's manifests and well-known files to build a `RepoFacts` object. This pass never writes or mutates anything on disk.
2. **Generate** — render `RepoFacts` into Markdown, emitting only the sections that have backing data.

There is no network access and no LLM call: it is fast, deterministic, and safe to run in CI. You can also use it as a library:

```js
import { detectRepo, generateAgentsMd } from 'agentsmd';

const facts = detectRepo(process.cwd());
const markdown = generateAgentsMd(facts);
```

## Contributing

Issues and pull requests are welcome.

```bash
git clone https://github.com/BitmapAsset/agents-md.git
cd agents-md
npm install
npm run build
npm test
```

Adding support for a new language or framework usually means a small change in `src/detect.ts` plus a fixture and assertion in `test/`. Keep detection conservative: only emit a fact when the signal is unambiguous.

## License

[MIT](./LICENSE) © 2026 Gravity (BitmapAsset)
