import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const count = await prisma.task.count();
  if (count > 0) return;

  await prisma.task.createMany({
    data: [
      {
        title: "Wire task CRUD flows",
        description: "Create task list, detail editing, and delete flow for the DevLog workspace.",
        priority: "high",
        status: "in_progress",
        notes: "Keep the UX dense and useful for daily engineering work.",
      },
      {
        title: "Add AI decomposition",
        description: "Let the agent inspect a task and generate subtasks or ask clarifying questions.",
        priority: "high",
        status: "todo",
      },
      {
        title: "Document agent workflow",
        description: "Explain how Context7, skills, and the coding agent were used during implementation.",
        priority: "medium",
        status: "todo",
      },
    ],
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
