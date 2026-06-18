import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'dist', 'cli.js');

let work;

/** Build a minimal but realistic Node/TS project in a temp directory. */
before(() => {
  work = mkdtempSync(join(tmpdir(), 'mkagents-cli-'));
  writeFileSync(
    join(work, 'package.json'),
    JSON.stringify(
      {
        name: 'cli-fixture',
        version: '1.0.0',
        description: 'CLI end-to-end fixture.',
        license: 'MIT',
        scripts: { build: 'tsc', test: 'node --test' },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(work, 'package-lock.json'), '{}');
  writeFileSync(join(work, 'tsconfig.json'), '{}');
  mkdirSync(join(work, 'src'));
  writeFileSync(join(work, 'src', 'index.ts'), 'export const x = 1;\n');
});

after(() => {
  rmSync(work, { recursive: true, force: true });
});

function run(args, cwd = work) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('default run writes AGENTS.md only', () => {
  const r = run(['.']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(work, 'AGENTS.md')));
  assert.ok(!existsSync(join(work, 'CLAUDE.md')), 'no other format without a flag');
});

test('--all writes every agent format to its expected path', () => {
  const r = run(['.', '--all', '--force']);
  assert.equal(r.status, 0, r.stderr);
  for (const rel of [
    'AGENTS.md',
    'CLAUDE.md',
    join('.cursor', 'rules', 'agents.mdc'),
    join('.github', 'copilot-instructions.md'),
    'GEMINI.md',
    '.windsurfrules',
  ]) {
    assert.ok(existsSync(join(work, rel)), `expected ${rel} to be written`);
  }
  const claude = readFileSync(join(work, 'CLAUDE.md'), 'utf8');
  assert.match(claude, /^# CLAUDE\.md — cli-fixture/m);
});

test('--format selects a subset', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mkagents-subset-'));
  writeFileSync(join(dir, 'go.mod'), 'module example.com/app\n\ngo 1.22\n');
  const r = run(['.', '--format', 'gemini,windsurf'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'GEMINI.md')));
  assert.ok(existsSync(join(dir, '.windsurfrules')));
  assert.ok(!existsSync(join(dir, 'AGENTS.md')), 'unselected format is not written');
  rmSync(dir, { recursive: true, force: true });
});

test('existing files are not overwritten without --force', () => {
  // AGENTS.md exists from an earlier test; re-running should skip and exit 1.
  const r = run(['.', '--format', 'agents']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /already exists/);
});

test('--check passes when the target file exists and is non-empty', () => {
  const r = run(['.', '--check', '--format', 'claude']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Check passed/);
});

test('--check fails when the target file is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mkagents-check-'));
  const r = run(['.', '--check', '--format', 'claude'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Check failed/);
  rmSync(dir, { recursive: true, force: true });
});

test('--check fails when the target file is empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mkagents-empty-'));
  writeFileSync(join(dir, 'AGENTS.md'), '   \n');
  const r = run(['.', '--check'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Check failed/);
  rmSync(dir, { recursive: true, force: true });
});

test('an unknown format is a clean error', () => {
  const r = run(['.', '--format', 'nope']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown format/);
});

test('--output cannot combine with multiple formats', () => {
  const r = run(['.', '--all', '-o', 'x.md']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--output can only be used with a single format/);
});

test('--stdout prints without writing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mkagents-stdout-'));
  writeFileSync(join(dir, 'Cargo.toml'), '[package]\nname = "demo"\n');
  const r = run(['.', '--stdout', '--format', 'claude'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^# CLAUDE\.md — demo/m);
  assert.ok(!existsSync(join(dir, 'CLAUDE.md')), 'stdout must not write a file');
  rmSync(dir, { recursive: true, force: true });
});
