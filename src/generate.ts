import type { RepoFacts, DetectedCommand } from './types.js';

const GENERATOR_URL = 'https://github.com/BitmapAsset/agents-md';

/** Group detected commands by their intent label, preserving first-seen order. */
function commandsByLabel(commands: DetectedCommand[]): Map<string, DetectedCommand[]> {
  const map = new Map<string, DetectedCommand[]>();
  for (const cmd of commands) {
    const list = map.get(cmd.label);
    if (list) list.push(cmd);
    else map.set(cmd.label, [cmd]);
  }
  return map;
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}\n`;
}

function codeBlock(lines: string[], lang = 'bash'): string {
  return ['```' + lang, ...lines, '```'].join('\n');
}

function renderOverview(facts: RepoFacts): string {
  const lines: string[] = [];
  if (facts.description) {
    lines.push(facts.description, '');
  }
  const bullets: string[] = [];
  if (facts.languages.length > 0) {
    bullets.push(`- **Language:** ${facts.languages.join(', ')}`);
  }
  if (facts.frameworks.length > 0) {
    bullets.push(`- **Stack:** ${facts.frameworks.join(', ')}`);
  }
  if (facts.packageManager) {
    bullets.push(`- **Package manager:** ${facts.packageManager}`);
  }
  if (facts.nodeVersion) {
    bullets.push(`- **Node:** ${facts.nodeVersion}`);
  }
  if (facts.license) {
    bullets.push(`- **License:** ${facts.license}`);
  }
  if (facts.workspaces.length > 0) {
    bullets.push(`- **Monorepo:** yes (workspaces: ${facts.workspaces.join(', ')})`);
  }
  lines.push(...bullets);
  return lines.join('\n');
}

function renderSetup(facts: RepoFacts): string | undefined {
  const install = facts.commands.filter((c) => c.label === 'Install');
  if (install.length === 0 && !facts.nodeVersion) return undefined;
  const lines: string[] = [];
  if (facts.nodeVersion) {
    lines.push(`Requires Node \`${facts.nodeVersion}\`.`, '');
  }
  if (install.length > 0) {
    lines.push('Install dependencies:', '', codeBlock(install.map((c) => c.command)));
  }
  return lines.join('\n');
}

function renderCommandSection(facts: RepoFacts, labels: string[]): string | undefined {
  const grouped = commandsByLabel(facts.commands);
  const picked: DetectedCommand[] = [];
  for (const label of labels) {
    const list = grouped.get(label);
    if (list) picked.push(...list);
  }
  if (picked.length === 0) return undefined;
  const lines = picked.map((c) => c.command);
  return codeBlock(lines);
}

function renderStructure(facts: RepoFacts): string | undefined {
  if (facts.directories.length === 0 && facts.workspaces.length === 0) return undefined;
  const lines: string[] = [];
  for (const dir of facts.directories) {
    lines.push(`- \`${dir.path}\` — ${dir.description}`);
  }
  if (facts.workspaces.length > 0) {
    lines.push(`- Workspaces: ${facts.workspaces.map((w) => `\`${w}\``).join(', ')}`);
  }
  return lines.join('\n');
}

function renderConventions(facts: RepoFacts): string {
  const notes: string[] = [];
  if (facts.languages.includes('TypeScript')) {
    notes.push('- This is a TypeScript project; keep code typed and run the type-checker before committing.');
  }
  const hasLint = facts.commands.some((c) => c.label === 'Lint');
  const hasFormat = facts.commands.some((c) => c.label === 'Format');
  if (hasLint) {
    notes.push('- Run the linter before opening a pull request; fix issues rather than disabling rules.');
  }
  if (hasFormat) {
    notes.push('- Use the project formatter; do not hand-format code that the formatter owns.');
  }
  const hasTest = facts.commands.some((c) => c.label === 'Test');
  if (hasTest) {
    notes.push('- Add or update tests when changing behavior, and make sure the suite passes.');
  }
  if (facts.workspaces.length > 0) {
    notes.push('- This is a monorepo; scope changes to the relevant workspace and avoid cross-package coupling.');
  }
  if (notes.length === 0) {
    notes.push('- Match the existing code style and keep changes focused and minimal.');
  }
  return notes.join('\n');
}

function renderDoDont(facts: RepoFacts): string {
  const dos: string[] = ['Read this file and existing code before making changes.'];
  const donts: string[] = ['Introduce unrelated changes or large refactors without being asked.'];

  const test = facts.commands.find((c) => c.label === 'Test');
  if (test) {
    dos.push(`Run \`${test.command}\` and ensure it passes before finishing.`);
  }
  const build = facts.commands.find((c) => c.label === 'Build');
  if (build) {
    dos.push(`Run \`${build.command}\` to confirm the project still compiles.`);
  }
  if (facts.packageManager) {
    donts.push(
      `Use a different package manager than \`${facts.packageManager}\` or commit a foreign lockfile.`,
    );
  }
  donts.push('Commit secrets, credentials, or generated build artifacts.');

  const doLines = dos.map((d) => `- ${d}`).join('\n');
  const dontLines = donts.map((d) => `- ${d}`).join('\n');
  return `**Do**\n\n${doLines}\n\n**Don't**\n\n${dontLines}`;
}

/**
 * Render a complete AGENTS.md document from detected facts.
 * Only sections backed by real data are included.
 */
export function generateAgentsMd(facts: RepoFacts): string {
  const title = facts.name ?? 'Project';
  const parts: string[] = [];

  parts.push(`# AGENTS.md — ${title}\n`);
  parts.push(
    'Guidance for AI coding agents (Cursor, Claude Code, Copilot, OpenClaw, Hermes, Codex, and others) working in this repository. ' +
      'Treat it as the source of truth for how to build, test, and contribute here.\n',
  );

  parts.push(section('Project overview', renderOverview(facts)));

  const setup = renderSetup(facts);
  if (setup) parts.push(section('Setup', setup));

  const buildRun = renderCommandSection(facts, ['Build', 'Start', 'Develop']);
  if (buildRun) parts.push(section('Build & run', buildRun));

  const test = renderCommandSection(facts, ['Test']);
  if (test) parts.push(section('Test', test));

  const lint = renderCommandSection(facts, ['Lint', 'Format', 'Type-check']);
  if (lint) parts.push(section('Lint & format', lint));

  const structure = renderStructure(facts);
  if (structure) parts.push(section('Project structure', structure));

  parts.push(section('Conventions & notes for agents', renderConventions(facts)));
  parts.push(section('Do / Don’t', renderDoDont(facts)));

  parts.push(
    `---\n\n_Generated by [agents-md](${GENERATOR_URL}). Review and edit to add project-specific context._\n`,
  );

  return parts.join('\n');
}
