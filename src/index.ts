/**
 * Public programmatic API for mkagents.
 *
 * @example
 * import { detectRepo, generateAgentsMd } from 'mkagents';
 *
 * const facts = detectRepo(process.cwd());
 * const markdown = generateAgentsMd(facts);
 *
 * @example Emit every supported agent format from one scan.
 * import { detectRepo, FORMATS } from 'mkagents';
 *
 * const facts = detectRepo(process.cwd());
 * for (const fmt of FORMATS) {
 *   const contents = fmt.render(facts); // write to fmt.path
 * }
 */

export { detectRepo } from './detect.js';
export { generateAgentsMd, renderDocument } from './generate.js';
export { FORMATS, findFormat, formatIds } from './formats.js';
export type { RenderOptions } from './generate.js';
export type { AgentFormat } from './formats.js';
export type {
  RepoFacts,
  DetectedCommand,
  DetectedDirectory,
  PackageManager,
} from './types.js';
