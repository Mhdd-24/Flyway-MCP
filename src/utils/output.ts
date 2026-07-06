import { FW } from '../config/flyway.config.js';

export function sliceOutput(output: string): string {
  return output.length <= FW.LIMITS.OUTPUT_SLICE ? output : `${output.slice(0, FW.LIMITS.OUTPUT_SLICE)}\n... (truncated)`;
}
