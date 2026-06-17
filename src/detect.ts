import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import type {
  RepoFacts,
  PackageManager,
  DetectedCommand,
  DetectedDirectory,
} from './types.js';

/** Read a file as UTF-8, returning undefined on any error. */
function readText(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

/** Parse JSON safely, returning undefined on any error. */
function readJson(file: string): Record<string, unknown> | undefined {
  const text = readText(file);
  if (text === undefined) return undefined;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * A small, curated map from package.json scripts (or well-known equivalents)
 * to the intent label we surface in AGENTS.md. Order defines display order.
 */
const SCRIPT_INTENTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['dev', 'start:dev', 'serve'], label: 'Develop' },
  { keys: ['build', 'compile'], label: 'Build' },
  { keys: ['start'], label: 'Start' },
  { keys: ['test', 'test:unit'], label: 'Test' },
  { keys: ['lint'], label: 'Lint' },
  { keys: ['format', 'fmt'], label: 'Format' },
  { keys: ['typecheck', 'type-check', 'tsc'], label: 'Type-check' },
];

function pmRun(pm: PackageManager, script: string): string {
  switch (pm) {
    case 'npm':
      return `npm run ${script}`;
    case 'pnpm':
      return `pnpm ${script}`;
    case 'yarn':
      return `yarn ${script}`;
    case 'bun':
      return `bun run ${script}`;
  }
}

function pmInstall(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npm install';
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install';
    case 'bun':
      return 'bun install';
  }
}

function detectPackageManager(root: string): PackageManager | undefined {
  // Lockfiles are the most reliable signal.
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) return 'bun';
  if (existsSync(join(root, 'package-lock.json'))) return 'npm';
  // Fall back to the packageManager field if present.
  return undefined;
}

function workspaceGlobs(pkg: Record<string, unknown> | undefined, root: string): string[] {
  const globs: string[] = [];
  if (pkg) {
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) {
      for (const entry of ws) {
        const s = asString(entry);
        if (s) globs.push(s);
      }
    } else if (ws && typeof ws === 'object') {
      const packages = (ws as Record<string, unknown>).packages;
      if (Array.isArray(packages)) {
        for (const entry of packages) {
          const s = asString(entry);
          if (s) globs.push(s);
        }
      }
    }
  }
  // pnpm declares workspaces separately.
  const pnpmWs = readText(join(root, 'pnpm-workspace.yaml'));
  if (pnpmWs) {
    for (const line of pnpmWs.split('\n')) {
      const m = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
      if (m && m[1]) globs.push(m[1].trim());
    }
  }
  return [...new Set(globs)];
}

/** Known top-level directories and a short description for each. */
const KNOWN_DIRS: Array<{ names: string[]; description: string }> = [
  { names: ['src', 'lib', 'app'], description: 'Application / library source code' },
  { names: ['test', 'tests', '__tests__', 'spec'], description: 'Automated tests' },
  { names: ['docs', 'documentation'], description: 'Documentation' },
  { names: ['examples', 'example'], description: 'Usage examples' },
  { names: ['scripts', 'tools', 'bin'], description: 'Scripts and tooling' },
  { names: ['public', 'static', 'assets'], description: 'Static assets' },
  { names: ['packages', 'apps'], description: 'Workspace packages (monorepo)' },
  { names: ['config'], description: 'Configuration' },
  { names: ['migrations'], description: 'Database migrations' },
];

function detectDirectories(root: string): DetectedDirectory[] {
  const found: DetectedDirectory[] = [];
  const seen = new Set<string>();
  for (const group of KNOWN_DIRS) {
    for (const name of group.names) {
      if (seen.has(name)) continue;
      if (isDir(join(root, name))) {
        found.push({ path: `${name}/`, description: group.description });
        seen.add(name);
        break; // one representative per group is enough
      }
    }
  }
  return found;
}

function pushCommand(
  commands: DetectedCommand[],
  seen: Set<string>,
  cmd: DetectedCommand,
): void {
  if (seen.has(cmd.command)) return;
  seen.add(cmd.command);
  commands.push(cmd);
}

/** Detect Node / JS / TS facts from package.json. Mutates `facts`. */
function detectNode(root: string, facts: RepoFacts): void {
  const pkgPath = join(root, 'package.json');
  const pkg = readJson(pkgPath);
  if (!pkg) return;

  facts.languages.push('JavaScript');

  // TypeScript signal: tsconfig or a typescript dependency.
  const allDeps = {
    ...(pkg.dependencies as Record<string, unknown> | undefined),
    ...(pkg.devDependencies as Record<string, unknown> | undefined),
  };
  if (existsSync(join(root, 'tsconfig.json')) || 'typescript' in allDeps) {
    facts.languages.unshift('TypeScript');
  }

  facts.name ??= asString(pkg.name);
  facts.description ??= asString(pkg.description);
  facts.license ??= asString(pkg.license);

  const engines = pkg.engines as Record<string, unknown> | undefined;
  if (engines) facts.nodeVersion = asString(engines.node);

  // packageManager field (e.g. "pnpm@9.1.0") as a fallback signal.
  if (!facts.packageManager) {
    const pmField = asString(pkg.packageManager);
    if (pmField) {
      const name = pmField.split('@')[0] as PackageManager;
      if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') {
        facts.packageManager = name;
      }
    }
  }
  const pm: PackageManager = facts.packageManager ?? 'npm';
  facts.packageManager = pm;

  facts.workspaces.push(...workspaceGlobs(pkg, root));

  // Framework detection from dependency names.
  detectFrameworks(allDeps, facts);

  // Install command.
  const seen = new Set<string>();
  pushCommand(facts.commands, seen, {
    label: 'Install',
    command: pmInstall(pm),
    source: 'package manager',
  });

  // Scripts → intent commands.
  const scripts = (pkg.scripts as Record<string, unknown> | undefined) ?? {};
  for (const intent of SCRIPT_INTENTS) {
    for (const key of intent.keys) {
      if (asString(scripts[key])) {
        pushCommand(facts.commands, seen, {
          label: intent.label,
          command: pmRun(pm, key),
          source: `package.json scripts.${key}`,
        });
        break;
      }
    }
  }
}

function detectFrameworks(deps: Record<string, unknown>, facts: RepoFacts): void {
  const known: Array<[string, string]> = [
    ['next', 'Next.js'],
    ['react', 'React'],
    ['vue', 'Vue'],
    ['svelte', 'Svelte'],
    ['@angular/core', 'Angular'],
    ['express', 'Express'],
    ['fastify', 'Fastify'],
    ['@nestjs/core', 'NestJS'],
    ['vite', 'Vite'],
    ['vitest', 'Vitest'],
    ['jest', 'Jest'],
    ['electron', 'Electron'],
    ['astro', 'Astro'],
  ];
  for (const [dep, label] of known) {
    if (dep in deps && !facts.frameworks.includes(label)) {
      facts.frameworks.push(label);
    }
  }
}

/** Detect Python facts. Mutates `facts`. */
function detectPython(root: string, facts: RepoFacts): void {
  const pyproject = readText(join(root, 'pyproject.toml'));
  const hasSetup = existsSync(join(root, 'setup.py')) || existsSync(join(root, 'setup.cfg'));
  const hasReqs = existsSync(join(root, 'requirements.txt'));
  if (!pyproject && !hasSetup && !hasReqs) return;

  facts.languages.push('Python');

  if (pyproject) {
    // Lightweight TOML scraping for name/description without a TOML dep.
    const name = pyproject.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    if (name && name[1]) facts.name ??= name[1];
    const desc = pyproject.match(/^\s*description\s*=\s*["']([^"']+)["']/m);
    if (desc && desc[1]) facts.description ??= desc[1];
    const lic = pyproject.match(/^\s*license\s*=\s*["']([^"']+)["']/m);
    if (lic && lic[1]) facts.license ??= lic[1];

    if (/\[tool\.poetry\]/.test(pyproject)) facts.frameworks.push('Poetry');
    if (/django/i.test(pyproject)) facts.frameworks.push('Django');
    if (/fastapi/i.test(pyproject)) facts.frameworks.push('FastAPI');
    if (/flask/i.test(pyproject)) facts.frameworks.push('Flask');
  }

  const seen = new Set(facts.commands.map((c) => c.command));
  if (hasReqs) {
    pushCommand(facts.commands, seen, {
      label: 'Install',
      command: 'pip install -r requirements.txt',
      source: 'requirements.txt',
    });
  } else if (pyproject && /\[tool\.poetry\]/.test(pyproject)) {
    pushCommand(facts.commands, seen, {
      label: 'Install',
      command: 'poetry install',
      source: 'pyproject.toml (poetry)',
    });
  } else if (pyproject || hasSetup) {
    pushCommand(facts.commands, seen, {
      label: 'Install',
      command: 'pip install -e .',
      source: 'pyproject.toml',
    });
  }
  // Test runner heuristic.
  if (
    isDir(join(root, 'tests')) ||
    isDir(join(root, 'test')) ||
    (pyproject ? /pytest/i.test(pyproject) : false)
  ) {
    pushCommand(facts.commands, seen, {
      label: 'Test',
      command: 'pytest',
      source: 'pytest',
    });
  }
}

/** Detect Go facts. Mutates `facts`. */
function detectGo(root: string, facts: RepoFacts): void {
  const goMod = readText(join(root, 'go.mod'));
  if (!goMod) return;
  facts.languages.push('Go');
  const moduleLine = goMod.match(/^module\s+(\S+)/m);
  if (moduleLine && moduleLine[1] && !facts.name) {
    facts.name = basename(moduleLine[1]);
  }
  const seen = new Set(facts.commands.map((c) => c.command));
  pushCommand(facts.commands, seen, { label: 'Build', command: 'go build ./...', source: 'go.mod' });
  pushCommand(facts.commands, seen, { label: 'Test', command: 'go test ./...', source: 'go.mod' });
  pushCommand(facts.commands, seen, { label: 'Format', command: 'go fmt ./...', source: 'go toolchain' });
}

/** Detect Rust facts. Mutates `facts`. */
function detectRust(root: string, facts: RepoFacts): void {
  const cargo = readText(join(root, 'Cargo.toml'));
  if (!cargo) return;
  facts.languages.push('Rust');
  const name = cargo.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  if (name && name[1]) facts.name ??= name[1];
  const desc = cargo.match(/^\s*description\s*=\s*["']([^"']+)["']/m);
  if (desc && desc[1]) facts.description ??= desc[1];
  const lic = cargo.match(/^\s*license\s*=\s*["']([^"']+)["']/m);
  if (lic && lic[1]) facts.license ??= lic[1];

  const seen = new Set(facts.commands.map((c) => c.command));
  pushCommand(facts.commands, seen, { label: 'Build', command: 'cargo build', source: 'Cargo.toml' });
  pushCommand(facts.commands, seen, { label: 'Test', command: 'cargo test', source: 'Cargo.toml' });
  pushCommand(facts.commands, seen, { label: 'Format', command: 'cargo fmt', source: 'rustfmt' });
}

/** Resolve a license from a LICENSE file when not declared in metadata. */
function detectLicenseFile(root: string, facts: RepoFacts): void {
  if (facts.license) return;
  let licenseFile: string | undefined;
  try {
    licenseFile = readdirSync(root).find((f) => /^licen[sc]e(\.[a-z]+)?$/i.test(f));
  } catch {
    licenseFile = undefined;
  }
  if (!licenseFile) return;
  const text = readText(join(root, licenseFile));
  if (!text) return;
  const head = text.slice(0, 400);
  if (/MIT License/i.test(head)) facts.license = 'MIT';
  else if (/Apache License/i.test(head)) facts.license = 'Apache-2.0';
  else if (/GNU GENERAL PUBLIC LICENSE/i.test(head)) facts.license = 'GPL';
  else if (/BSD/i.test(head)) facts.license = 'BSD';
  else if (/Mozilla Public License/i.test(head)) facts.license = 'MPL-2.0';
  else facts.license = 'See LICENSE';
}

/**
 * Scan a directory and return the facts discovered about it.
 * Read-only: never writes or mutates anything on disk.
 */
export function detectRepo(targetPath: string): RepoFacts {
  const root = resolve(targetPath);
  const facts: RepoFacts = {
    root,
    languages: [],
    frameworks: [],
    commands: [],
    workspaces: [],
    directories: [],
    isGitRepo: isDir(join(root, '.git')),
    isEmpty: false,
  };

  facts.packageManager = detectPackageManager(root);

  detectNode(root, facts);
  detectPython(root, facts);
  detectGo(root, facts);
  detectRust(root, facts);

  // Fallbacks shared across ecosystems.
  facts.name ??= basename(root);
  detectLicenseFile(root, facts);
  facts.directories = detectDirectories(root);

  // De-duplicate language / framework lists while preserving order.
  facts.languages = [...new Set(facts.languages)];
  facts.frameworks = [...new Set(facts.frameworks)];

  facts.isEmpty =
    facts.languages.length === 0 &&
    facts.commands.length === 0 &&
    facts.directories.length === 0;

  return facts;
}
