/**
 * The multi-format export registry.
 *
 * From a single repository scan (one `RepoFacts` object) agents-md can emit the
 * instruction file in every major AI-agent format. Each entry below knows the
 * path/filename the target tool expects and how to render the document for it.
 * The body is shared across formats via `renderDocument`; only the title,
 * intro, and any tool-specific wrapper (such as Cursor's `.mdc` frontmatter)
 * differ.
 */

import type { RepoFacts } from './types.js';
import { renderDocument, DEFAULT_INTRO } from './generate.js';

export interface AgentFormat {
  /** Stable identifier used by the `--format` flag. */
  id: string;
  /** Human-readable target name for help text and logs. */
  label: string;
  /** Default path (relative to the repo root) the file is written to. */
  path: string;
  /** Render the full file contents for this format from detected facts. */
  render: (facts: RepoFacts) => string;
}

function projectName(facts: RepoFacts): string {
  return facts.name ?? 'Project';
}

/**
 * Cursor reads project rules from `.cursor/rules/*.mdc`, where each file begins
 * with a small YAML frontmatter block. `alwaysApply: true` makes the rule apply
 * to every request, which matches the intent of a repo-wide instruction file.
 */
function renderCursorMdc(facts: RepoFacts): string {
  const body = renderDocument(facts, {
    title: `# ${projectName(facts)} — agent rules`,
    intro: DEFAULT_INTRO,
  });
  const frontmatter = [
    '---',
    'description: Project-wide guidance for AI coding agents.',
    'globs:',
    'alwaysApply: true',
    '---',
    '',
  ].join('\n');
  return `${frontmatter}${body}`;
}

/**
 * The full set of supported agent instruction formats, keyed by `id`.
 * Order here defines the order used by `--all`.
 */
export const FORMATS: AgentFormat[] = [
  {
    id: 'agents',
    label: 'AGENTS.md (open standard)',
    path: 'AGENTS.md',
    render: (facts) =>
      renderDocument(facts, {
        title: `# AGENTS.md — ${projectName(facts)}`,
        intro: DEFAULT_INTRO,
      }),
  },
  {
    id: 'claude',
    label: 'Claude Code (CLAUDE.md)',
    path: 'CLAUDE.md',
    render: (facts) =>
      renderDocument(facts, {
        title: `# CLAUDE.md — ${projectName(facts)}`,
        intro: DEFAULT_INTRO,
      }),
  },
  {
    id: 'cursor',
    label: 'Cursor (.cursor/rules/agents.mdc)',
    path: '.cursor/rules/agents.mdc',
    render: renderCursorMdc,
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot (.github/copilot-instructions.md)',
    path: '.github/copilot-instructions.md',
    render: (facts) =>
      renderDocument(facts, {
        title: `# Copilot instructions — ${projectName(facts)}`,
        intro: DEFAULT_INTRO,
      }),
  },
  {
    id: 'gemini',
    label: 'Gemini CLI (GEMINI.md)',
    path: 'GEMINI.md',
    render: (facts) =>
      renderDocument(facts, {
        title: `# GEMINI.md — ${projectName(facts)}`,
        intro: DEFAULT_INTRO,
      }),
  },
  {
    id: 'windsurf',
    label: 'Windsurf (.windsurfrules)',
    path: '.windsurfrules',
    render: (facts) =>
      renderDocument(facts, {
        title: `# ${projectName(facts)} — agent rules`,
        intro: DEFAULT_INTRO,
      }),
  },
];

/** Look up a format by its `id`, or return undefined when unknown. */
export function findFormat(id: string): AgentFormat | undefined {
  return FORMATS.find((f) => f.id === id);
}

/** The list of valid format ids, for help text and error messages. */
export function formatIds(): string[] {
  return FORMATS.map((f) => f.id);
}
