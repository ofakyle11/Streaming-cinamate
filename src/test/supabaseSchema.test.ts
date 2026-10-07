import { describe, expect, it } from 'vitest';
import schema from '../../supabase/schema.sql?raw';
import migration from '../../supabase/migrations/20260929010000_sync_tables.sql?raw';
import processDeletions from '../../supabase/migrations/20260929020000_process_account_deletions.sql?raw';
import devices from '../../supabase/migrations/20261006000000_devices.sql?raw';
import stripPassword from '../../supabase/migrations/20261006010000_disable_password_sign_in.sql?raw';
import adminUsers from '../../supabase/migrations/20261007000000_admin_users.sql?raw';
import rlsCheck from '../../supabase/tests/rls_check.sql?raw';
import config from '../../supabase/config.toml?raw';
import ci from '../../.github/workflows/ci.yml?raw';
import pkg from '../../package.json';
import seed from '../../supabase/seed.sql?raw';
import { SYNC_CONFLICT_COLUMNS } from '../services/db/live';
import { AUTH_CALLBACK_PATH } from '../services/auth/validate';
import { DEVICES_TABLE } from '../services/auth/devices';

const SYNC_TABLES = ['profiles', 'watchlist', 'history', 'ratings'] as const;

/** First `key = value` line in supabase/config.toml. */
const value = (key: string) => {
  const m = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm').exec(config);
  return m?.[1].trim();
};

describe('supabase/schema.sql', () => {
  it('ships identically as a migration', () => {
    expect(migration).toBe(schema);
  });

  it.each(SYNC_TABLES)(
    '%s: table keyed by user, RLS on, own-row policies for every command',
    (table) => {
      expect(schema).toMatch(new RegExp(`create table if not exists public\\.${table} \\(`));
      expect(schema).toMatch(
        new RegExp(`alter table public\\.${table}\\s+enable row level security;`),
      );
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
    },
  );

  it('never grants anything to anon', () => {
    expect(schema).not.toMatch(/grant[^;]*to anon/i);
  });

  it('seeds every sync table', () => {
    for (const t of SYNC_TABLES) expect(seed).toContain(`insert into public.${t}`);
  });

  it('seeds a demo auth user GoTrue can look up, with an email identity', () => {
    const users = seed.split('insert into auth.users (')[1].split('on conflict')[0];
    const [cols, vals] = users.split('values');
    const names = cols
      .replace(/\)\s*$/, '')
      .split(',')
      .map((c) => c.trim());
    // Nullable token columns must be '' (GoTrue scans them into strings).
    for (const col of [
      'confirmation_token',
      'recovery_token',
      'email_change_token_new',
      'email_change',
    ]) {
      expect(names).toContain(col);
    }
    const values = vals
      .trim()
      .replace(/^\(/, '')
      .replace(/\)\s*$/, '')
      .split(/,\n/)
      .map((v) => v.trim());
    expect(values).toHaveLength(names.length);
    for (const col of [
      'confirmation_token',
      'recovery_token',
      'email_change_token_new',
      'email_change',
    ]) {
      expect(values[names.indexOf(col)]).toBe("''");
    }
    const identity = seed.split('insert into auth.identities (')[1]?.split('on conflict')[0] ?? '';
    expect(identity).toContain("'email'");
    expect(identity).toMatch(/"sub":"11111111-1111-4111-8111-111111111111"/);
    expect(identity).toMatch(/"email":"demo@lastframe\.local"/);
  });
});

describe('supabase/migrations/20260929020000_process_account_deletions.sql', () => {
  const sql = processDeletions;

  it('defines lf_process_account_deletions() as a security definer returning integer', () => {
    const header = sql
      .split('create or replace function public.lf_process_account_deletions()')[1]
      ?.split('as $$')[0];
    expect(header).toBeDefined();
    expect(header).toMatch(/returns integer/);
    expect(header).toMatch(/language plpgsql/);
    expect(header).toMatch(/security definer/);
    expect(header).toMatch(/set search_path = public, auth/);
  });

  it('deletes the auth user for each pending request', () => {
    const body = sql.split('as $$')[1].split('$$;')[0];
    expect(body).toMatch(/from public\.account_deletion_requests/);
    expect(body).toMatch(/where r\.processed_at is null/);
    expect(body).toMatch(/delete from auth\.users where id = /);
    expect(body).toMatch(/return processed;/);
  });

  it('revokes execute from clients and grants it only to service_role', () => {
    expect(sql).toMatch(
      /revoke all on function public\.lf_process_account_deletions\(\) from public, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.lf_process_account_deletions\(\) to service_role;/,
    );
    expect(sql).not.toMatch(/grant[^;]*to (anon|authenticated|public)\b/i);
  });
});

describe('supabase/migrations/20261006000000_devices.sql', () => {
  it('is keyed by user with RLS on and own-row policies for every command', () => {
    expect(DEVICES_TABLE).toBe('devices');
    expect(devices).toMatch(/create table if not exists public\.devices \(/);
    const body = devices.split('create table if not exists public.devices (')[1].split(');')[0];
    expect(body).toMatch(
      /user_id\s+uuid\s+not null default auth\.uid\(\) references auth\.users \(id\) on delete cascade/,
    );
    expect(body).toContain('primary key (user_id, id)');
    expect(devices).toMatch(/alter table public\.devices enable row level security;/);
    for (const cmd of ['select', 'insert', 'update', 'delete']) {
      expect(devices).toMatch(
        new RegExp(
          `create policy "devices_${cmd}_own" on public\\.devices\\s+for ${cmd} to authenticated (using|with check) \\(user_id = auth\\.uid\\(\\)\\)`,
        ),
      );
    }
    expect(devices).toMatch(/revoke all on public\.devices from anon;/);
    expect(devices).not.toMatch(/grant[^;]*to anon/i);
  });

  it('keeps a revoked device revoked and owns the timestamps server side', () => {
    const fn = devices
      .split('create or replace function public.lf_devices_before_write()')[1]
      .split('$$;')[0];
    expect(fn).toContain("raise exception 'user_id cannot change'");
    expect(fn).toContain('new.created_at := old.created_at;');
    expect(fn).toMatch(/if old\.revoked_at is not null then\s+new\.revoked_at := old\.revoked_at;/);
    expect(fn).toContain('new.last_seen_at := now();');
    expect(devices).toMatch(
      /before insert or update on public\.devices\s+for each row execute function public\.lf_devices_before_write\(\);/,
    );
  });
});

describe('supabase/migrations/20261006010000_disable_password_sign_in.sql', () => {
  it('strips the password from every auth.users write, so only email links sign in', () => {
    expect(stripPassword).toContain('new.encrypted_password := null;');
    expect(stripPassword).toMatch(
      /create trigger lf_strip_password\s+before insert or update of encrypted_password on auth\.users\s+for each row execute function public\.lf_strip_password\(\);/,
    );
    expect(stripPassword).toMatch(
      /revoke all on function public\.lf_strip_password\(\) from public, anon, authenticated;/,
    );
    expect(stripPassword).toContain(
      'update auth.users set encrypted_password = null where encrypted_password is not null;',
    );
  });
});

describe('RLS check (supabase/tests/rls_check.sql) and CI', () => {
  it('covers every per-user table as a second user and as anon', () => {
    for (const t of [...SYNC_TABLES, 'devices', 'account_deletion_requests']) {
      expect(rlsCheck).toContain(`public.${t}`);
    }
    expect(rlsCheck).toContain('set local role anon;');
    expect(rlsCheck).toContain("'B can read % rows of A in %'");
    expect(rlsCheck).toContain('on conflict (user_id, id) do update'); // the client\'s real upsert against a revoked row
    expect(rlsCheck).toContain('a password survived insert into auth.users');
    expect(rlsCheck).toContain('lf_process_account_deletions()');
    expect(rlsCheck.trim().endsWith('rollback;')).toBe(true);
  });

  it('admin allow-list: RLS on, read-own only, no client write path, anon gets nothing', () => {
    expect(adminUsers).toMatch(/alter table public\.admin_users enable row level security;/);
    expect(adminUsers).toMatch(
      /create policy "admin_users_select_self" on public\.admin_users\s+for select to authenticated using \(email = public\.lf_jwt_email\(\)\)/,
    );
    expect(adminUsers).not.toMatch(/create policy[^;]*for (insert|update|delete)/);
    expect(adminUsers).not.toMatch(/grant[^;]*to anon/i);
    expect(adminUsers).toMatch(
      /revoke all on public\.admin_users from public, anon, authenticated;/,
    );
    expect(adminUsers).toMatch(/create or replace function public\.lf_is_admin\(\)/);
    expect(adminUsers).toMatch(/revoke all on function public\.lf_is_admin\(\) from public, anon;/);
    // Covered by the RLS check: listed user true, other user false, anon no execute, no client writes.
    expect(rlsCheck).toContain('lf_is_admin()');
    expect(rlsCheck).toContain("'A added an admin'");
    expect(rlsCheck).toContain("'B can see admin rows'");
  });

  it('runs in CI against a plain PostgreSQL through npm run db:check', () => {
    expect(pkg.scripts['db:check']).toBe('./scripts/db-check.sh');
    expect(ci).toContain('run: ./scripts/db-check.sh');
    expect(ci).toMatch(/image: postgres:17/); // matches [db] major_version in config.toml
    expect(value('major_version')).toBe('17');
  });
});

describe('supabase/config.toml', () => {
  it('points the magic link at the callback route on the production origin', () => {
    expect(value('site_url')).toBe('"https://lastframe.tv"');
    const urls = config.split('additional_redirect_urls = [')[1].split(']')[0];
    expect(urls).toContain(`"https://lastframe.tv${AUTH_CALLBACK_PATH}"`);
    expect(urls).toContain(`"http://localhost:5173${AUTH_CALLBACK_PATH}"`);
    expect(urls).not.toMatch(/netlify\.app/); // previews stay in mock mode
  });

  it('applies the agreed auth settings: 15 minute links, 45 s resend, signups on, double confirm', () => {
    expect(value('otp_expiry')).toBe('900');
    // Email confirmation on: a password sign-up through the public API cannot
    // produce a ready account for someone else's address (see the strip-password migration).
    expect(value('enable_confirmations')).toBe('true');
    expect(config).toContain('[auth.email.template.confirmation]');
    expect(config.match(/content_path = "\.\/templates\/magic-link\.html"/g)).toHaveLength(2);
    expect(value('max_frequency')).toBe('"45s"');
    expect(value('enable_signup')).toBe('true');
    expect(value('double_confirm_changes')).toBe('true');
    expect(value('enable_anonymous_sign_ins')).toBe('false');
    expect(value('subject')).toBe('"Your Lastframe.tv sign-in link"');
  });

  it('keeps every secret out of the file (env() references only)', () => {
    for (const key of ['pass', 'secret', 'client_id']) {
      for (const m of config.matchAll(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'gm'))) {
        expect(m[1].trim()).toMatch(/^"env\([A-Z_]+\)"$/);
      }
    }
    expect(config).not.toMatch(/re_[A-Za-z0-9]{10,}/); // a pasted Resend key
    expect(config).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // a pasted JWT
  });
});
