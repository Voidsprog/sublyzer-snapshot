import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONFIG_DIR } from '../constants.js';
import type { CustomRuleResult } from '../analyze/types.js';
import { relPath, walkSourceFiles } from '../analyze/walk.js';

export type CustomRule = {
  id: string;
  message: string;
  severity?: 'info' | 'warning' | 'high';
  /** Glob-like prefix e.g. src/pages */
  files?: string;
  /** Regex pattern tested against file content */
  match?: string;
  /** If true, rule passes when pattern is NOT found */
  invert?: boolean;
  /** Regex tested against file path */
  pathMatch?: string;
};

export type RulesFile = { rules: CustomRule[] };

export function loadCustomRules(anchor: string): CustomRule[] {
  const jsonPath = path.join(anchor, CONFIG_DIR, 'rules.json');
  if (!fs.existsSync(jsonPath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as RulesFile | CustomRule[];
    return Array.isArray(raw) ? raw : raw.rules || [];
  } catch {
    return [];
  }
}

export async function loadCustomRulesAsync(anchor: string): Promise<CustomRule[]> {
  const base = path.join(anchor, CONFIG_DIR);
  const jsPath = path.join(base, 'rules.js');
  const rules = loadCustomRules(anchor);
  if (rules.length || !fs.existsSync(jsPath)) return rules;

  try {
    const mod = (await import(pathToFileURL(jsPath).href)) as {
      default?: RulesFile | CustomRule[];
      rules?: CustomRule[];
    };
    const raw = mod.default ?? mod.rules;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : raw.rules || [];
  } catch {
    return rules;
  }
}

function fileMatchesRule(file: string, rule: CustomRule): boolean {
  if (rule.files) {
    const prefix = rule.files.replace(/\\/g, '/');
    if (!file.includes(prefix) && !file.startsWith(prefix)) return false;
  }
  if (rule.pathMatch) {
    if (!new RegExp(rule.pathMatch).test(file)) return false;
  }
  return true;
}

export function runCustomRules(root: string, rules: CustomRule[]): CustomRuleResult[] {
  if (!rules.length) return [];
  const files = walkSourceFiles(root, { maxDepth: 8 });
  const results: CustomRuleResult[] = [];

  for (const rule of rules) {
    if (!rule.match && !rule.pathMatch) {
      results.push({
        ruleId: rule.id,
        passed: true,
        message: rule.message,
        severity: rule.severity || 'info',
      });
      continue;
    }

    let matched = false;
    let matchedFile: string | undefined;

    for (const file of files) {
      const rel = relPath(root, file);
      if (!fileMatchesRule(rel, rule)) continue;

      if (rule.pathMatch && new RegExp(rule.pathMatch).test(rel)) {
        matched = true;
        matchedFile = rel;
        break;
      }

      if (rule.match) {
        let content: string;
        try {
          content = fs.readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        if (new RegExp(rule.match, 'm').test(content)) {
          matched = true;
          matchedFile = rel;
          break;
        }
      }
    }

    const found = matched;
    const violated = rule.invert ? !found : found;

    if (violated) {
      results.push({
        ruleId: rule.id,
        passed: false,
        message: rule.message,
        severity: rule.severity || 'warning',
        file: matchedFile,
      });
    }
  }

  return results;
}
