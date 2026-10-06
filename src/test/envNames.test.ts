import { describe, expect, it } from 'vitest';
import ts from 'typescript';

/**
 * Guard: client code (everything under src/) is bundled and public. It may
 * only read VITE_* variables (plus Vite's built-ins), and never process.env,
 * so a server-only secret such as TMDB_API_KEY can never be inlined.
 */
const sources = import.meta.glob('/src/**/*.{ts,tsx,js,jsx,mjs}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const isTest = (path: string) => /\.test\.[jt]sx?$/.test(path) || path.startsWith('/src/test/');
const VITE_BUILTINS = new Set(['DEV', 'PROD', 'MODE', 'BASE_URL', 'SSR']);

/**
 * Strip comments with the TypeScript scanner, so documentation that names a
 * variable does not trip the guard, while `/*` inside strings, templates and
 * regex literals is left alone.
 */
function code(text: string): string {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, text);
  let out = '';
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (
      kind === ts.SyntaxKind.SingleLineCommentTrivia ||
      kind === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      out += ' ';
    } else {
      out += scanner.getTokenText();
    }
  }
  return out;
}

function offendingEnvNames(path: string, text: string): string[] {
  const src = code(text);
  const out: string[] = [];
  if (/\bprocess\s*\.\s*env\b/.test(src) || /\bprocess\s*\[\s*['"]env['"]\s*\]/.test(src)) {
    out.push(`${path}: process.env`);
  }
  for (const m of src.matchAll(
    /import\.meta\.env\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([^'"]+)['"]\s*\])/g,
  )) {
    const name = m[1] ?? m[2];
    if (!name.startsWith('VITE_') && !VITE_BUILTINS.has(name))
      out.push(`${path}: import.meta.env.${name}`);
  }
  // Destructuring such as `const { TMDB_API_KEY } = import.meta.env`.
  for (const m of src.matchAll(/\{([^{}]*)\}\s*=\s*import\.meta\.env\b/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .split(':')[0]
        .replace(/\.\.\./, '')
        .split('=')[0]
        .trim();
      if (name && !name.startsWith('VITE_') && !VITE_BUILTINS.has(name))
        out.push(`${path}: { ${name} } = import.meta.env`);
    }
  }
  // Aliases such as `const env = import.meta.env; env.TMDB_API_KEY`.
  for (const alias of src.matchAll(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*import\.meta\.env\b(?!\s*[.[])/g,
  )) {
    const re = new RegExp(
      `\\b${alias[1]}\\s*(?:\\.\\s*([A-Za-z_$][\\w$]*)|\\[\\s*['"]([^'"]+)['"]\\s*\\])`,
      'g',
    );
    for (const m of src.matchAll(re)) {
      const name = m[1] ?? m[2];
      if (!name.startsWith('VITE_') && !VITE_BUILTINS.has(name))
        out.push(`${path}: ${alias[1]}.${name}`);
    }
  }
  return out;
}

describe('client env names', () => {
  const files = Object.entries(sources).filter(([path]) => !isTest(path));

  it('scans the whole client tree', () => {
    expect(files.some(([p]) => p === '/src/services/index.ts')).toBe(true);
    expect(files.length).toBeGreaterThan(50);
  });

  it('only references VITE_* variables and never process.env under src/', () => {
    expect(files.flatMap(([path, text]) => offendingEnvNames(path, text))).toEqual([]);
  });

  it('catches the patterns it is meant to catch', () => {
    expect(offendingEnvNames('a', 'const k = process.env.TMDB_API_KEY;')).toHaveLength(1);
    expect(offendingEnvNames('a', "const k = process['env'].X;")).toHaveLength(1);
    expect(offendingEnvNames('a', 'const k = import.meta.env.TMDB_API_KEY;')).toHaveLength(1);
    expect(offendingEnvNames('a', "const k = import.meta.env['SECRET'];")).toHaveLength(1);
    expect(
      offendingEnvNames(
        'a',
        'const env = import.meta.env;\nconst k = env.SUPABASE_SERVICE_ROLE_KEY;',
      ),
    ).toHaveLength(1);
    expect(
      offendingEnvNames('a', 'const env = import.meta.env;\nconst k = env.VITE_X ?? env.DEV;'),
    ).toEqual([]);
    expect(offendingEnvNames('a', '// reads process.env on the server only\nconst x = 1;')).toEqual(
      [],
    );
  });
});
