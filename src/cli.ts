#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectRepo } from './detect.js';
import { FORMATS, findFormat, formatIds, type AgentFormat } from './formats.js';

interface CliOptions {
  target: string;
  output?: string;
  formats: string[];
  all: boolean;
  stdout: boolean;
  force: boolean;
  dryRun: boolean;
  check: boolean;
  help: boolean;
  version: boolean;
}

const HELP = `agentsmd — one scan, every agent's instruction file

Usage:
  agentsmd [path] [options]

Arguments:
  path                  Directory to scan (default: current directory)

Options:
      --format <list>   Comma-separated agent formats to emit
                        (${formatIds().join(', ')})
      --all             Emit every supported format
  -o, --output <path>   Output path (single format only; overrides its default)
      --stdout          Print the result to stdout instead of writing a file
      --check           CI mode: exit non-zero if a target file is missing/empty
  -f, --force           Overwrite existing output files
      --dry-run         Show what would be written without writing it
  -h, --help            Show this help message
  -v, --version         Show the version number

Formats:
${FORMATS.map((f) => `  ${f.id.padEnd(9)} ${f.label} -> ${f.path}`).join('\n')}

Examples:
  agentsmd                            Write AGENTS.md for the current directory
  agentsmd --all                      Emit every agent's instruction file
  agentsmd --format claude,cursor     Emit CLAUDE.md and Cursor rules
  agentsmd --stdout                   Preview AGENTS.md without writing
  agentsmd --check --format claude    Fail CI if CLAUDE.md is missing or empty
  agentsmd -o docs/AGENTS.md          Write AGENTS.md to a custom location`;

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    target: '.',
    formats: [],
    all: false,
    stdout: false,
    force: false,
    dryRun: false,
    check: false,
    help: false,
    version: false,
  };
  let targetSet = false;

  const addFormats = (value: string): void => {
    for (const raw of value.split(',')) {
      const id = raw.trim();
      if (id.length > 0 && !opts.formats.includes(id)) opts.formats.push(id);
    }
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-v':
      case '--version':
        opts.version = true;
        break;
      case '--stdout':
        opts.stdout = true;
        break;
      case '--all':
        opts.all = true;
        break;
      case '--check':
        opts.check = true;
        break;
      case '-f':
      case '--force':
        opts.force = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--format': {
        const next = argv[i + 1];
        if (!next || next.startsWith('-')) {
          throw new Error(`Option ${arg} requires a value`);
        }
        addFormats(next);
        i++;
        break;
      }
      case '-o':
      case '--output': {
        const next = argv[i + 1];
        if (!next || next.startsWith('-')) {
          throw new Error(`Option ${arg} requires a value`);
        }
        opts.output = next;
        i++;
        break;
      }
      default: {
        if (arg.startsWith('--format=')) {
          addFormats(arg.slice('--format='.length));
        } else if (arg.startsWith('--output=')) {
          opts.output = arg.slice('--output='.length);
        } else if (arg.startsWith('-') && arg !== '-') {
          throw new Error(`Unknown option: ${arg}`);
        } else if (!targetSet) {
          opts.target = arg;
          targetSet = true;
        } else {
          throw new Error(`Unexpected argument: ${arg}`);
        }
      }
    }
  }
  return opts;
}

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/cli.js -> ../package.json
    const pkgPath = join(here, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Resolve the requested format list, validating ids. Defaults to AGENTS.md. */
function resolveFormats(opts: CliOptions): AgentFormat[] {
  if (opts.all) return [...FORMATS];
  if (opts.formats.length === 0) {
    const agents = findFormat('agents');
    return agents ? [agents] : [];
  }
  const resolved: AgentFormat[] = [];
  for (const id of opts.formats) {
    const fmt = findFormat(id);
    if (!fmt) {
      throw new Error(`Unknown format "${id}". Valid formats: ${formatIds().join(', ')}`);
    }
    if (!resolved.includes(fmt)) resolved.push(fmt);
  }
  return resolved;
}

/** True when the file at `path` is missing or contains only whitespace. */
function isMissingOrEmpty(path: string): boolean {
  if (!existsSync(path)) return true;
  try {
    if (statSync(path).size === 0) return true;
    return readFileSync(path, 'utf8').trim().length === 0;
  } catch {
    return true;
  }
}

/** CI guard: report any requested format whose file is missing or empty. */
function runCheck(root: string, formats: AgentFormat[]): number {
  const missing: string[] = [];
  for (const fmt of formats) {
    const path = join(root, fmt.path);
    if (isMissingOrEmpty(path)) missing.push(fmt.path);
  }
  if (missing.length > 0) {
    process.stderr.write(
      `Check failed: missing or empty instruction file(s): ${missing.join(', ')}.\n` +
        'Run agentsmd to generate them.\n',
    );
    return 1;
  }
  process.stdout.write(
    `Check passed: ${formats.map((f) => f.path).join(', ')} present and non-empty.\n`,
  );
  return 0;
}

function main(argv: string[]): number {
  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n\n${HELP}\n`);
    return 1;
  }

  if (opts.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }
  if (opts.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }

  const targetPath = resolve(opts.target);
  if (!existsSync(targetPath)) {
    process.stderr.write(`Error: path does not exist: ${targetPath}\n`);
    return 1;
  }

  let formats: AgentFormat[];
  try {
    formats = resolveFormats(opts);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    return 1;
  }

  // --output targets a single file, so it cannot combine with multi-format.
  if (opts.output && formats.length > 1) {
    process.stderr.write('Error: --output can only be used with a single format.\n');
    return 1;
  }

  // CI mode only inspects the filesystem; it never scans or writes.
  if (opts.check) {
    return runCheck(targetPath, formats);
  }

  const facts = detectRepo(targetPath);
  if (facts.isEmpty) {
    process.stderr.write(
      `Warning: no recognizable project signals found in ${targetPath}.\n` +
        'Looked for package.json, pyproject.toml, go.mod, Cargo.toml, pom.xml, ' +
        'build.gradle, Gemfile, composer.json, *.csproj, and common directories.\n',
    );
    return 1;
  }

  if (opts.stdout) {
    if (formats.length > 1) {
      process.stderr.write('Error: --stdout can only be used with a single format.\n');
      return 1;
    }
    process.stdout.write(formats[0].render(facts));
    return 0;
  }

  const written: string[] = [];
  const skipped: string[] = [];

  for (const fmt of formats) {
    const content = fmt.render(facts);
    const outPath = opts.output ? resolve(opts.output) : join(targetPath, fmt.path);

    if (opts.dryRun) {
      process.stdout.write(
        `Dry run: would write ${content.length} bytes to ${outPath}\n`,
      );
      continue;
    }

    if (existsSync(outPath) && !opts.force) {
      skipped.push(outPath);
      continue;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content, 'utf8');
    written.push(outPath);
  }

  if (opts.dryRun) return 0;

  const detected = [
    facts.languages.join(', ') || 'unknown stack',
    facts.commands.length > 0 ? `${facts.commands.length} commands` : null,
  ]
    .filter(Boolean)
    .join(', ');

  for (const path of written) {
    process.stdout.write(`Wrote ${path}\n`);
  }
  if (written.length > 0) {
    process.stdout.write(`Detected: ${detected}.\n`);
  }
  for (const path of skipped) {
    process.stderr.write(`Skipped ${path} (already exists; use --force to overwrite).\n`);
  }

  // Nothing written and everything skipped is a non-success exit for scripting.
  if (written.length === 0 && skipped.length > 0) return 1;
  return 0;
}

process.exit(main(process.argv.slice(2)));
