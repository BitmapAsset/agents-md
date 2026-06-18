import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { detectRepo } from '../dist/index.js';

/** Create a temp dir seeded with the given files, run detectRepo, then clean up. */
function detectWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'mkagents-detect-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), body);
    }
    return detectRepo(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');

function byLabel(facts) {
  const map = {};
  for (const c of facts.commands) {
    if (!(c.label in map)) map[c.label] = c.command;
  }
  return map;
}

test('detects a Java/Maven project from pom.xml', () => {
  const facts = detectRepo(join(fixtures, 'java-maven'));
  assert.ok(facts.languages.includes('Java'));
  assert.ok(facts.frameworks.includes('Maven'));
  assert.equal(facts.name, 'sample-service', 'name comes from pom.xml artifactId');

  const cmd = byLabel(facts);
  assert.equal(cmd.Build, 'mvn package');
  assert.equal(cmd.Test, 'mvn test');
  assert.equal(facts.isEmpty, false);
});

test('detects a Ruby project with rspec from Gemfile', () => {
  const facts = detectRepo(join(fixtures, 'ruby-app'));
  assert.ok(facts.languages.includes('Ruby'));
  assert.ok(facts.frameworks.includes('Sinatra'));

  const cmd = byLabel(facts);
  assert.equal(cmd.Install, 'bundle install');
  assert.equal(cmd.Test, 'bundle exec rspec', 'spec/ dir should select rspec');
});

test('detects a PHP/Laravel project from composer.json', () => {
  const facts = detectRepo(join(fixtures, 'php-app'));
  assert.ok(facts.languages.includes('PHP'));
  assert.ok(facts.frameworks.includes('Laravel'));
  assert.equal(facts.name, 'acme/sample-app');
  assert.equal(facts.description, 'A sample PHP application used as a test fixture.');
  assert.equal(facts.license, 'MIT');

  const cmd = byLabel(facts);
  assert.equal(cmd.Install, 'composer install');
  assert.equal(cmd.Test, 'composer test', 'composer scripts.test should be preferred');
});

test('detection stays conservative for an unknown directory', () => {
  const facts = detectRepo(here); // the test/ directory itself has no manifest
  assert.equal(facts.languages.length, 0, 'no language manifest means no language facts');
});

test('detects a Deno project from deno.json', () => {
  const facts = detectWith({
    'deno.json': JSON.stringify({ name: 'sample-deno', tasks: { dev: 'deno run -A main.ts' } }),
  });
  assert.ok(facts.languages.includes('Deno'));
  assert.ok(facts.languages.includes('TypeScript'), 'Deno is TypeScript-first');
  const cmd = byLabel(facts);
  assert.equal(cmd.Develop, 'deno task dev', 'tasks.dev maps to deno task dev');
  assert.equal(cmd.Test, 'deno test');
});

test('detects an Elixir project from mix.exs', () => {
  const facts = detectWith({
    'mix.exs':
      'defmodule Sample.MixProject do\n  use Mix.Project\n  def project do\n    [app: :sample_app, version: "0.1.0"]\n  end\nend\n',
  });
  assert.ok(facts.languages.includes('Elixir'));
  assert.equal(facts.name, 'sample_app', 'name comes from the app atom');
  const cmd = byLabel(facts);
  assert.equal(cmd.Install, 'mix deps.get');
  assert.equal(cmd.Test, 'mix test');
});

test('detects a Swift package from Package.swift', () => {
  const facts = detectWith({
    'Package.swift':
      '// swift-tools-version:5.9\nimport PackageDescription\nlet package = Package(name: "SampleKit")\n',
  });
  assert.ok(facts.languages.includes('Swift'));
  assert.equal(facts.name, 'SampleKit');
  const cmd = byLabel(facts);
  assert.equal(cmd.Build, 'swift build');
  assert.equal(cmd.Test, 'swift test');
});
