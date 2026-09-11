import { Pool, QueryResultRow, types } from "pg";

// DATE columns (oid 1082) come back as plain "YYYY-MM-DD" strings instead of
// pg's default JS Date objects — those are ambiguous for a date-only value
// (constructed as UTC midnight, which can shift a day depending on how it's
// later formatted/interpreted) and procurement's required_by/expected dates
// have no time component to justify the extra type. TIMESTAMPTZ columns
// (events' start_at etc., oid 1184) are untouched.
types.setTypeParser(1082, (value) => value);

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({
    connectionString,
    // rejectUnauthorized: false is intentional, not a leftover — this targets
    // Vercel's provisioned Neon Postgres (see SETUP.md), whose pooled
    // connection endpoint presents a cert chain that Node's default trust
    // store doesn't always validate cleanly in serverless environments.
    // Traffic is still TLS-encrypted; only certificate-chain validation is
    // skipped. sslmode=disable (e.g. local dev) opts out of TLS entirely.
    ssl: connectionString.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
}

// Lazily created so importing this module (e.g. during `next build`'s route
// analysis) never requires DATABASE_URL to be set — only actually running a
// query does. Reused across invocations in the same server instance.
function getPool(): Pool {
  if (!global.__pgPool) {
    global.__pgPool = createPool();
  }
  return global.__pgPool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  const res = await getPool().query<T>(text, params);
  return res;
}
