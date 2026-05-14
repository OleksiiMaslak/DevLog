import { Suspense } from "react";
import { listTasks } from "@/lib/tasks";
import { DevLogWorkspace } from "@/components/devlog-workspace";

export default function Home() {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <TasksLoader />
    </Suspense>
  );
}

async function TasksLoader() {
  const tasks = await listTasks({ status: "all", sort: "priority" });
  return <DevLogWorkspace initialTasks={tasks} />;
}

function AppSkeleton() {
  return (
    <main className="min-h-screen bg-canvas p-4 md:p-6">
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <div className="h-20 rounded-lg bg-panel" />
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
          <div className="h-96 rounded-lg bg-panel" />
          <div className="h-96 rounded-lg bg-panel" />
          <div className="h-96 rounded-lg bg-panel" />
        </div>
      </div>
    </main>
  );
}
