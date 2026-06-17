#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectRepo } from './detect.js';
import { generateAgentsMd } from './generate.js';

interface CliOptions {
  target: string;
  output: string;
  stdout: boolean;
  force: boolean;
  dryRun: boolean;
  help: boolean;
  version: boolean;
}

const HELP = `agents-md — generate an AGENTS.md for AI coding agents

Usage:
  agents-md [path] [options]

Arguments:
  path                 Directory to scan (default: current directory)

Options:
  -o, --output <path>  Output file path (default: AGENTS.md)
      --stdout         Print the result to stdout instead of writing a file
  -f, --force          Overwrite an existing output file
      --dry-run        Show what would be written without writing it
  -h, --help           Show this help message
  -v, --version        Show the version number

Examples:
  agents-md                      Scan the current directory
  agents-md ./my-project         Scan a specific directory
  agents-md --stdout             Preview without writing a file
  agents-md -o docs/AGENTS.md    Write to a custom location`;

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    target: '.',
    output: 'AGENTS.md',
    stdout: false,
    force: false,
    dryRun: false,
    help: false,
    version: false,
  };
  let targetSet = false;

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
      case '-f':
      case '--force':
        opts.force = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
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
        if (arg.startsWith('--output=')) {
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

  const facts = detectRepo(targetPath);
  if (facts.isEmpty) {
    process.stderr.write(
      `Warning: no recognizable project signals found in ${targetPath}.\n` +
        'Looked for package.json, pyproject.toml, go.mod, Cargo.toml, and common directories.\n',
    );
    return 1;
  }

  const markdown = generateAgentsMd(facts);

  if (opts.stdout) {
    process.stdout.write(markdown);
    return 0;
  }

  const outPath = resolve(opts.output);

  if (opts.dryRun) {
    process.stdout.write(
      `Dry run: would write ${markdown.length} bytes to ${outPath}\n\n${markdown}`,
    );
    return 0;
  }

  if (existsSync(outPath) && !opts.force) {
    process.stderr.write(
      `Warning: ${outPath} already exists. Use --force to overwrite, or --stdout to preview.\n`,
    );
    return 1;
  }

  writeFileSync(outPath, markdown, 'utf8');
  const detected = [
    facts.languages.join(', ') || 'unknown stack',
    facts.commands.length > 0 ? `${facts.commands.length} commands` : null,
  ]
    .filter(Boolean)
    .join(', ');
  process.stdout.write(`Wrote ${outPath} (${detected}).\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
