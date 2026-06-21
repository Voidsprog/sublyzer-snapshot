import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer || defaultValue || '';
  } finally {
    rl.close();
  }
}

export async function promptRequired(question: string, validate?: (v: string) => string | null): Promise<string> {
  for (;;) {
    const value = await prompt(question);
    if (!value) {
      console.log('  Required value.');
      continue;
    }
    if (validate) {
      const err = validate(value);
      if (err) {
        console.log(`  ${err}`);
        continue;
      }
    }
    return value;
  }
}

export async function promptOptional(question: string): Promise<string | undefined> {
  const value = await prompt(question);
  return value.trim() || undefined;
}
