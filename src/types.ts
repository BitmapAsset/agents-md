/**
 * Shared types describing the facts detected from a repository.
 *
 * Every field is optional or defensively typed: the generator only emits a
 * section when the corresponding data was actually found, so AGENTS.md never
 * contains fabricated information.
 */

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface DetectedCommand {
  /** Human-facing label, e.g. "Build". */
  label: string;
  /** The full command a user/agent should run, e.g. "npm run build". */
  command: string;
  /** Optional source note, e.g. "package.json scripts.build". */
  source?: string;
}

export interface DetectedDirectory {
  path: string;
  description: string;
}

export interface RepoFacts {
  /** Absolute path that was scanned. */
  root: string;
  /** Project name, if discoverable. */
  name?: string;
  /** One-line project description, if discoverable. */
  description?: string;
  /** SPDX-ish license identifier or label, if discoverable. */
  license?: string;
  /** Detected languages / ecosystems, most significant first. */
  languages: string[];
  /** Detected frameworks / notable libraries. */
  frameworks: string[];
  /** Detected package manager, if any. */
  packageManager?: PackageManager;
  /** Minimum Node version constraint, if declared. */
  nodeVersion?: string;
  /** Runnable commands grouped by intent. */
  commands: DetectedCommand[];
  /** Monorepo workspace globs, if this is a workspace root. */
  workspaces: string[];
  /** Notable top-level directories. */
  directories: DetectedDirectory[];
  /** Whether a git repository was detected at the root. */
  isGitRepo: boolean;
  /** True when no meaningful project signal was found at all. */
  isEmpty: boolean;
}
