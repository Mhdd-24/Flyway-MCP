import type { FlywayError } from '../interfaces/flyway.js';

function extractOffenders(output: string): string[] {
  const offenders: string[] = [];
  const lines = output.split(/\r?\n/);
  let inOffenders = false;
  for (const line of lines) {
    if (/Offenders:/i.test(line)) {
      inOffenders = true;
      continue;
    }
    if (inOffenders) {
      const match = line.match(/->\s*(.+)$/);
      if (match) {
        offenders.push(match[1].trim());
        continue;
      }
      if (line.trim() === '' || /^ERROR:/i.test(line)) {
        inOffenders = false;
      }
    }
  }
  return offenders;
}

export function analyzeFlywayOutput(output: string): FlywayError[] {
  const errors: FlywayError[] = [];
  const duplicateMatch = output.match(/Found more than one migration with version (\d+)/i);
  if (duplicateMatch) {
    errors.push({
      kind: 'duplicate_version',
      message: duplicateMatch[0],
      version: Number.parseInt(duplicateMatch[1], 10),
      offenders: extractOffenders(output),
    });
  }
  if (/checksum mismatch|validate failed|migration checksum/i.test(output)) {
    errors.push({ kind: 'checksum_mismatch', message: 'Migration checksum mismatch detected' });
  }
  const relationMatch = output.match(/relation "([^"]+)" does not exist/i);
  if (relationMatch) {
    const locationMatch = output.match(/Location\s*:\s*(.+?)\s*\(/i);
    const lineMatch = output.match(/Line\s*:\s*(\d+)/i);
    errors.push({
      kind: 'missing_relation',
      message: relationMatch[0],
      relation: relationMatch[1],
      migrationFile: locationMatch?.[1]?.trim(),
      line: lineMatch ? Number.parseInt(lineMatch[1], 10) : undefined,
    });
  }
  const placeholderMatch = output.match(/No value provided for placeholder: \$\{([^}]+)\}/i);
  if (placeholderMatch) {
    const locationMatch = output.match(/Script\s+(.+?)\s+failed/i) ?? output.match(/Location\s*:\s*(.+?)\s*\(/i);
    errors.push({
      kind: 'placeholder',
      message: placeholderMatch[0],
      placeholder: placeholderMatch[1],
      migrationFile: locationMatch?.[1]?.trim(),
    });
  }
  if (/Migration of schema .* failed/i.test(output) && errors.length === 0) {
    errors.push({ kind: 'failed_migration', message: 'Migration failed' });
  }
  if (errors.length === 0 && /ERROR:/i.test(output)) {
    errors.push({
      kind: 'unknown',
      message: output.split('\n').find((l) => /ERROR:/i.test(l)) ?? 'Unknown Flyway error',
    });
  }
  return errors;
}

export function primaryError(errors: FlywayError[]): FlywayError | undefined {
  const priority: FlywayError['kind'][] = ['duplicate_version', 'placeholder', 'missing_relation', 'checksum_mismatch', 'failed_migration', 'unknown'];
  for (const kind of priority) {
    const hit = errors.find((e) => e.kind === kind);
    if (hit) { return hit; }
  }
  return errors[0];
}