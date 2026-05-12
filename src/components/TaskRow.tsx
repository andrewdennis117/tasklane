import { Badge } from "./ui/badge";
import type { Task } from "../lib/api";

interface TaskRowProps {
  task: Task;
}

export function TaskRow({ task }: TaskRowProps) {
  return (
    <a
      href={task.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50"
    >
      <span className="shrink-0 font-mono text-xs text-primary">
        {task.source_id}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {task.title}
      </span>
      {task.priority && task.priority !== "No priority" && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {task.priority}
        </Badge>
      )}
    </a>
  );
}
