import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";

type Database = PgliteDatabase;

const globalForDb = globalThis as unknown as {
  chatbotDb?: Promise<Database>;
};

export function createDatabase(): Promise<Database> {
  if (!globalForDb.chatbotDb) {
    globalForDb.chatbotDb = openDatabase().catch((error) => {
      globalForDb.chatbotDb = undefined;
      throw error;
    });
  }
  return globalForDb.chatbotDb;
}

async function openDatabase(): Promise<Database> {
  if (process.env.POSTGRES_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(process.env.POSTGRES_URL, { max: 10 });
    return drizzle(client) as unknown as Database;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  const dataDir = path.join(process.cwd(), "data", "campus-db");
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);

  // PGlite 是进程内数据库，进程被强行结束时可能写坏数据文件。
  // 收到退出信号时先关闭数据库，把数据刷到磁盘。
  const closeOnExit = (signal: NodeJS.Signals) => {
    client
      .close()
      .catch(() => undefined)
      .finally(() => process.kill(process.pid, signal));
  };
  process.once("SIGINT", closeOnExit);
  process.once("SIGTERM", closeOnExit);
  const migrationsFolder = path.join(process.cwd(), "lib", "db", "migrations");
  const files = (await readdir(migrationsFolder))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = (await readFile(path.join(migrationsFolder, file), "utf8"))
      .replace(/\r\n/g, "\n")
      .replace(/--> statement-breakpoint/g, "");
    await client.exec(sql);
  }

  return drizzle(client);
}
