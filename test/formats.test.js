import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { detectRepo, FORMATS, findFormat, formatIds } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'node-ts');

test('the registry exposes every documented agent format', () => {
  const ids = formatIds();
  for (const id of ['agents', 'claude', 'cursor', 'copilot', 'gemini', 'windsurf']) {
    assert.ok(ids.includes(id), `format ${id} should be registered`);
  }
});

test('each format declares the path its tool expects', () => {
  const paths = Object.fromEntries(FORMATS.map((f) => [f.id, f.path]));
  assert.equal(paths.agents, 'AGENTS.md');
  assert.equal(paths.claude, 'CLAUDE.md');
  assert.equal(paths.cursor, '.cursor/rules/agents.mdc');
  assert.equal(paths.copilot, '.github/copilot-instructions.md');
  assert.equal(paths.gemini, 'GEMINI.md');
  assert.equal(paths.windsurf, '.windsurfrules');
});

test('coverage extends to Aider, Cline, Roo, Zed, Warp, Goose, and Junie', () => {
  const ids = formatIds();
  for (const id of ['aider', 'cline', 'roo', 'zed', 'warp', 'goose', 'junie']) {
    assert.ok(ids.includes(id), `format ${id} should be registered`);
  }
  const paths = Object.fromEntries(FORMATS.map((f) => [f.id, f.path]));
  assert.equal(paths.aider, 'CONVENTIONS.md');
  assert.equal(paths.cline, '.clinerules');
  assert.equal(paths.roo, '.roorules');
  assert.equal(paths.zed, '.rules');
  assert.equal(paths.warp, 'WARP.md');
  assert.equal(paths.goose, '.goosehints');
  assert.equal(paths.junie, '.junie/guidelines.md');
  // No two formats may collide on the same output path.
  const allPaths = FORMATS.map((f) => f.path);
  assert.equal(new Set(allPaths).size, allPaths.length, 'format paths must be unique');
});

test('every format renders from the same detected facts with a distinct title', () => {
  const facts = detectRepo(fixture);
  const titles = new Set();
  for (const fmt of FORMATS) {
    const out = fmt.render(facts);
    // The shared body (a real detected fact) must appear in every format.
    assert.match(out, /pnpm install/, `${fmt.id} should include detected install command`);
    assert.match(out, /## Project overview/, `${fmt.id} should include the shared body`);
    const firstLine = out.split('\n').find((l) => l.startsWith('# '));
    assert.ok(firstLine, `${fmt.id} should have a level-1 heading`);
    titles.add(firstLine);
  }
  assert.ok(titles.size >= 4, 'formats should not all share an identical title');
});

test('the Cursor format emits .mdc frontmatter with alwaysApply', () => {
  const facts = detectRepo(fixture);
  const cursor = findFormat('cursor');
  const out = cursor.render(facts);
  assert.match(out, /^---\n/, 'mdc must start with YAML frontmatter');
  assert.match(out, /alwaysApply: true/);
  assert.match(out, /\n---\n/, 'frontmatter must be closed');
  // Body still present after frontmatter.
  assert.match(out, /## Build & run/);
});

test('AGENTS.md and CLAUDE.md share the body but differ in title', () => {
  const facts = detectRepo(fixture);
  const agents = findFormat('agents').render(facts);
  const claude = findFormat('claude').render(facts);
  assert.match(agents, /^# AGENTS\.md — sample-widget/m);
  assert.match(claude, /^# CLAUDE\.md — sample-widget/m);
  // Identical command facts regardless of format.
  assert.match(agents, /pnpm test/);
  assert.match(claude, /pnpm test/);
});

test('findFormat returns undefined for an unknown id', () => {
  assert.equal(findFormat('does-not-exist'), undefined);
});
