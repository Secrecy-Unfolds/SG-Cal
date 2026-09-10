import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

function parseRole(value: string | undefined): "user" | "admin" | "super_admin" {
  return value === "super_admin" || value === "admin" ? value : "user";
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (check your .env file)");
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  });

  console.log("Creating tables (if they don't exist yet)...");
  const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  await pool.query(schema);

  const users = [
    {
      username: process.env.SEED_USER1_USERNAME,
      password: process.env.SEED_USER1_PASSWORD,
      email: process.env.SEED_USER1_EMAIL,
      role: parseRole(process.env.SEED_USER1_ROLE),
    },
    {
      username: process.env.SEED_USER2_USERNAME,
      password: process.env.SEED_USER2_PASSWORD,
      email: process.env.SEED_USER2_EMAIL,
      role: parseRole(process.env.SEED_USER2_ROLE),
    },
  ];

  for (const u of users) {
    if (!u.username || !u.password || !u.email) {
      console.log("Skipping a user: missing SEED_USER*_USERNAME/PASSWORD/EMAIL in .env");
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, email, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email, role = EXCLUDED.role`,
      [u.username, hash, u.email, u.role]
    );
    console.log(`Upserted user "${u.username}" (${u.email}, ${u.role})`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
