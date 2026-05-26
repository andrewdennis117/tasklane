import { TaskRow } from "./TaskRow";
import type { Task } from "../lib/api";

interface GitHubSectionProps {
  tasks: Task[];
  hasToken: boolean;
}

function groupByRepo(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const repo = task.repo || "unknown";
    if (!groups.has(repo)) {
      groups.set(repo, []);
    }
    groups.get(repo)!.push(task);
  }
  return groups;
}

function sortedRepoGroups(groups: Map<string, Task[]>): [string, Task[]][] {
  const entries = Array.from(groups.entries());
  // Sort each repo's tasks by updated_at desc
  for (const [, tasks] of entries) {
    tasks.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }
  // Sort repos by their most recent task
  entries.sort((a, b) => {
    const aLatest = new Date(a[1][0]?.updated_at ?? 0).getTime();
    const bLatest = new Date(b[1][0]?.updated_at ?? 0).getTime();
    return bLatest - aLatest;
  });
  return entries;
}

export function GitHubSection({ tasks, hasToken }: GitHubSectionProps) {
  if (!hasToken) {
    return (
      <p className="px-3 py-4 text-sm text-muted-foreground">
        Add a GitHub token in Settings to see your assigned issues.
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-muted-foreground">
        No open GitHub issues or PRs assigned to you.
      </p>
    );
  }

  const repoGroups = sortedRepoGroups(groupByRepo(tasks));

  return (
    <div className="space-y-4">
      {repoGroups.map(([repo, repoTasks]) => (
        <div key={repo}>
          <div className="mb-1 flex items-center gap-2 px-3">
            <span className="text-xs font-medium text-muted-foreground">
              {repo}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {repoTasks.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {repoTasks.map((task) => (
              <TaskRow key={task.source_id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
