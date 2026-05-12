import { TaskRow } from "./TaskRow";
import { EmptyState } from "./EmptyState";
import type { Task } from "../lib/api";

interface LinearSectionProps {
  tasks: Task[];
}

// Order status groups for display
const STATUS_ORDER = [
  "In Progress",
  "In Review",
  "Todo",
  "Backlog",
  "Triage",
];

function groupByStatus(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const status = task.status || "Unknown";
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status)!.push(task);
  }
  return groups;
}

function sortedGroups(groups: Map<string, Task[]>): [string, Task[]][] {
  const entries = Array.from(groups.entries());
  entries.sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a[0]);
    const bi = STATUS_ORDER.indexOf(b[0]);
    const aIdx = ai === -1 ? STATUS_ORDER.length : ai;
    const bIdx = bi === -1 ? STATUS_ORDER.length : bi;
    return aIdx - bIdx;
  });
  return entries;
}

export function LinearSection({ tasks }: LinearSectionProps) {
  if (tasks.length === 0) {
    return <EmptyState message="No open Linear issues assigned to you." />;
  }

  const groups = sortedGroups(groupByStatus(tasks));

  return (
    <div className="space-y-4">
      {groups.map(([status, statusTasks]) => (
        <div key={status}>
          <div className="mb-1 flex items-center gap-2 px-3">
            <span className="text-xs font-medium text-muted-foreground">
              {status}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {statusTasks.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {statusTasks.map((task) => (
              <TaskRow key={task.source_id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
