import Database from "better-sqlite3";

const url = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = url.replace(/^file:/, "");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" TEXT,
    CONSTRAINT "Task_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Task" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  );

  CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
  CREATE INDEX IF NOT EXISTS "Task_priority_idx" ON "Task"("priority");
  CREATE INDEX IF NOT EXISTS "Task_createdAt_idx" ON "Task"("createdAt");
  CREATE INDEX IF NOT EXISTS "Task_parentId_idx" ON "Task"("parentId");
`);

db.close();
