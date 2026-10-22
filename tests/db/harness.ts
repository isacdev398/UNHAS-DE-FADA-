import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

// Reproduz o mínimo do ambiente Supabase: schema auth, auth.uid() e os papéis.
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export const PROFESSIONAL_ID = "00000000-0000-4000-8000-000000000001";
export const SERVICE_MAO = "00000000-0000-4000-8000-0000000000a1";
export const SERVICE_PE = "00000000-0000-4000-8000-0000000000a2";

export async function createTestDb() {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.includes("storage"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Executa uma consulta como um papel do Supabase (anon/authenticated/service_role). */
export async function asRole<T>(
  db: TestDb,
  role: "anon" | "authenticated" | "service_role",
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export function tokenHash(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}
