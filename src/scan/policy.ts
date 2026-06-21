import type { FailOnLevel } from '../constants.js';
import type { ProjectSnapshot } from './snapshot.js';

export function shouldFailOnVulns(snapshot: ProjectSnapshot, level: FailOnLevel): boolean {
  const s = snapshot.summary;
  switch (level) {
    case 'critical':
      return s.criticalVulns > 0;
    case 'high':
      return s.criticalVulns > 0 || s.highVulns > 0;
    case 'moderate':
      return s.criticalVulns > 0 || s.highVulns > 0 || snapshot.audit.moderate > 0;
    case 'any':
      return s.vulnerablePackages > 0;
    default:
      return false;
  }
}

export function failOnMessage(snapshot: ProjectSnapshot, level: FailOnLevel): string {
  const s = snapshot.summary;
  return `Policy --fail-on ${level} triggered: ${s.criticalVulns} critical, ${s.highVulns} high, ${s.vulnerablePackages} total vulnerabilities`;
}
