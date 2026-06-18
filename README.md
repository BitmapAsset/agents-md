# mkagents

> One scan, every agent's instruction file. Scan a repo and generate a high-quality instruction file — `AGENTS.md`, `CLAUDE.md`, Cursor, Copilot, Gemini, Windsurf, Aider, Cline, Roo, Zed, Warp, Goose, Junie — that tells AI coding agents how to build, test, and work in your project. No API key, no LLM, fully deterministic.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

`AGENTS.md` is an emerging open convention for telling AI coding agents — Cursor, Claude Code, GitHub Copilot, OpenClaw, Hermes, Codex, and others — how to build, test, and contribute in a repository. But every tool also reads its own file. `mkagents` looks at your project once and writes a clean, accurate instruction file for **every** agent format in seconds.

## Why mkagents

- **One tool, every agent format.** From a single scan, emit 13 formats — `AGENTS.md`, `CLAUDE.md`, Cursor `.mdc` rules, Copilot, Gemini, Windsurf, Aider, Cline, Roo, Zed, Warp, Goose, and JetBrains Junie — all from the same detected facts, so they never drift apart.
- **Deterministic.** Same repo in, same files out. No randomness, no surprises in code review.
- **No API key, no network, no LLM.** It reads the signals already in your repo and renders Markdown. Nothing leaves your machine.
- **CI-friendly.** `--check` fails the build when an instruction file is missing or empty, so you can enforce it.
- **Honest by construction.** It only writes sections it has real data for — it never invents commands or makes up a stack.

Every AI agent that touches your codebase asks the same questions: What stack is this? How do I install it? How do I run the tests? What conventions should I follow? Today that context is scattered across the README, CI config, and the maintainers' heads — so agents guess, and guess wrong. `mkagents` reads `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `*.csproj`, lockfiles, scripts, and directory layout, then produces a structured instruction file grounded in those facts.

## Quick start

No install required:

```bash
npx mkagents
```

Or run it in any project directory:

```bash
# Scan the current directory and write AGENTS.md
npx mkagents

# Emit an instruction file for EVERY agent format at once
npx mkagents --all

# Emit a specific subset
npx mkagents --format claude,cursor

# Preview without writing a file
npx mkagents --stdout

# Scan a specific path
npx mkagents ./packages/api
```

Install it globally if you use it often:

```bash
npm install -g mkagents
mkagents --help
```

> The npm package and the installed command are both `mkagents` — think "make agents", in the spirit of `mkdir`. It writes the standard `AGENTS.md` plus every other agent instruction file. The GitHub repo is `BitmapAsset/mkagents`.

## Multi-format export

Different agents read different files. `mkagents` detects your project once and renders the same grounded facts into whichever formats you ask for. Use `--all`, or pick a subset with `--format <comma-list>`:

| Format id  | Tool                | Written to                          |
| ---------- | ------------------- | ----------------------------------- |
| `agents`   | Open standard       | `AGENTS.md`                         |
| `claude`   | Claude Code         | `CLAUDE.md`                         |
| `cursor`   | Cursor              | `.cursor/rules/agents.mdc`          |
| `copilot`  | GitHub Copilot      | `.github/copilot-instructions.md`   |
| `gemini`   | Gemini CLI          | `GEMINI.md`                         |
| `windsurf` | Windsurf            | `.windsurfrules`                    |
| `aider`    | Aider               | `CONVENTIONS.md`                    |
| `cline`    | Cline               | `.clinerules`                       |
| `roo`      | Roo Code            | `.roorules`                         |
| `zed`      | Zed                 | `.rules`                            |
| `warp`     | Warp                | `WARP.md`                           |
| `goose`    | Goose               | `.goosehints`                       |
| `junie`    | JetBrains Junie     | `.junie/guidelines.md`              |

Run `mkagents --list` to print this table from your installed version.

The default (no flag) writes only `AGENTS.md`. Each file is written in the path and shape its tool expects — for example, Cursor gets a `.mdc` file with the recommended YAML frontmatter (the older single-file `.cursorrules` still works, but `.cursor/rules/*.mdc` is the current convention). Existing files are never overwritten without `--force`.

```bash
# Generate every format, overwriting anything stale
npx mkagents --all --force
```

## Example

Running `mkagents` in a TypeScript project produces something like:

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
| `--format <list>`   | Comma-separated formats to emit (see table above)                 | `agents`    |
| `--all`             | Emit every supported format                                       | off         |
| `-o, --output <p>`  | Output path (single format only; overrides its default)           | per-format  |
| `--stdout`          | Print to stdout instead of writing a file (single format)         | off         |
| `--check`           | CI mode: exit non-zero if a target file is missing or empty       | off         |
| `-f, --force`       | Overwrite existing output files                                   | off         |
| `--dry-run`         | Show what would be written without writing it                     | off         |
| `--list`            | List every supported agent format and its file path              | —           |
| `-h, --help`        | Show help                                                         | —           |
| `-v, --version`     | Show the version                                                  | —           |

If a target file already exists and `--force` is not set, `mkagents` skips it and exits non-zero, so nothing is clobbered.

## Enforce it in CI

`--check` does not scan or write — it only verifies that the instruction files already exist and are non-empty, then exits non-zero if any are missing. Drop it into CI to keep your `AGENTS.md` (or any format) from rotting away:

```bash
# Fail the build if AGENTS.md is missing or empty
npx mkagents --check

# Enforce multiple formats
npx mkagents --check --format agents,claude,cursor
```

## What it detects

| Area              | Sources                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Language / stack  | `package.json` + `tsconfig.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle(.kts)`, `Gemfile`, `composer.json`, `*.csproj`, `deno.json`, `mix.exs`, `Package.swift` |
| Package manager   | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`                                   |
| Commands          | `package.json` scripts, plus ecosystem defaults (pytest, go, cargo, mvn/gradle, bundler, composer, dotnet, deno, mix, swift) |
| Frameworks        | Dependency names (Next.js, Remix, SvelteKit, Nuxt, NestJS, Vite, React, Vue, FastAPI, Django, Rails, Laravel, Symfony, and more) |
| Monorepo          | `workspaces` field and `pnpm-workspace.yaml`                                                      |
| Structure         | Common directories (`src`, `test`, `docs`, `packages`, …)                                         |
| License           | `package.json` / manifest metadata, or a `LICENSE` file                                           |

Detection is deliberately conservative: a fact is only emitted when the signal is unambiguous, so the generated file never contains a fabricated command or stack.

## How it works

`mkagents` runs in two read-only passes:

1. **Detect** — walk the target directory's manifests and well-known files to build a `RepoFacts` object. This pass never writes or mutates anything on disk.
2. **Generate** — render `RepoFacts` into Markdown, emitting only the sections that have backing data.

There is no network access and no LLM call: it is fast, deterministic, and safe to run in CI. You can also use it as a library:

```js
import { detectRepo, generateAgentsMd, FORMATS } from 'mkagents';

const facts = detectRepo(process.cwd());

// A single AGENTS.md:
const markdown = generateAgentsMd(facts);

// Or render every supported agent format from the same facts:
for (const fmt of FORMATS) {
  const contents = fmt.render(facts); // write to fmt.path
}
```

## Contributing

Issues and pull requests are welcome.

```bash
git clone https://github.com/BitmapAsset/mkagents.git
cd mkagents
npm install
npm run build
npm test
```

Adding support for a new language or framework usually means a small change in `src/detect.ts` plus a fixture and assertion in `test/`. Keep detection conservative: only emit a fact when the signal is unambiguous.

## License

[MIT](./LICENSE) © 2026 Gravity (BitmapAsset)
