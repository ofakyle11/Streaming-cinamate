import { describe, expect, it } from 'vitest';
import schema from '../../supabase/schema.sql?raw';
import migration from '../../supabase/migrations/20260929010000_sync_tables.sql?raw';
import seed from '../../supabase/seed.sql?raw';
import { SYNC_CONFLICT_COLUMNS } from '../services/db/live';

const SYNC_TABLES = ['profiles', 'watchlist', 'history', 'ratings'] as const;

describe('supabase/schema.sql', () => {
  it('ships identically as a migration', () => {
    expect(migration).toBe(schema);
  });

  it.each(SYNC_TABLES)('%s: table keyed by user, RLS on, own-row policies for every command', (table) => {
    expect(schema).toMatch(new RegExp(`create table if not exists public\\.${table} \\(`));
    expect(schema).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security;`));
    for (const cmd of ['select', 'insert', 'update', 'delete']) {
      const policy = new RegExp(
        `create policy "${table}_${cmd}_own" on public\\.${table}\\s+for ${cmd} to authenticated (using|with check) \\(user_id = auth\\.uid\\(\\)\\)`,
      );
      expect(schema).toMatch(policy);
    }
    // Upsert conflict target used by the client must be the table's primary key.
    const pk = SYNC_CONFLICT_COLUMNS[table].split(',').join(', ');
    const body = schema.split(`create table if not exists public.${table} (`)[1].split(');')[0];
    expect(body).toContain(`primary key (${pk})`);
    expect(body).toMatch(/user_id\s+uuid\s+not null default auth\.uid\(\)/);
  });

  it('never grants anything to anon', () => {
    expect(schema).not.toMatch(/grant[^;]*to anon/i);
  });

  it('seeds every sync table', () => {
    for (const t of SYNC_TABLES) expect(seed).toContain(`insert into public.${t}`);
  });

  it('seeds a demo auth user GoTrue can look up, with an email identity', () => {
    const users = seed.split('insert into auth.users (')[1].split('on conflict')[0];
    const [cols, vals] = users.split('values');
    const names = cols.replace(/\)\s*$/, '').split(',').map((c) => c.trim());
    // Nullable token columns must be '' (GoTrue scans them into strings).
    for (const col of ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change']) {
      expect(names).toContain(col);
    }
    const values = vals.trim().replace(/^\(/, '').replace(/\)\s*$/, '').split(/,\n/).map((v) => v.trim());
    expect(values).toHaveLength(names.length);
    for (const col of ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change']) {
      expect(values[names.indexOf(col)]).toBe("''");
    }
    const identity = seed.split('insert into auth.identities (')[1]?.split('on conflict')[0] ?? '';
    expect(identity).toContain("'email'");
    expect(identity).toMatch(/"sub":"11111111-1111-4111-8111-111111111111"/);
    expect(identity).toMatch(/"email":"demo@lastframe\.local"/);
  });
});
