/**
 * Public programmatic API for agents-md.
 *
 * @example
 * import { detectRepo, generateAgentsMd } from '@bitmapasset/agents-md';
 *
 * const facts = detectRepo(process.cwd());
 * const markdown = generateAgentsMd(facts);
 */

export { detectRepo } from './detect.js';
export { generateAgentsMd } from './generate.js';
export type {
  RepoFacts,
  DetectedCommand,
  DetectedDirectory,
  PackageManager,
} from './types.js';
