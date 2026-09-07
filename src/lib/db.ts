import { Pool, QueryResultRow } from "pg";

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
