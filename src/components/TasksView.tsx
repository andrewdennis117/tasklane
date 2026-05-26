import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { LinearSection } from "./LinearSection";
import { GitHubSection } from "./GitHubSection";
import {
  getTasksLinear,
  syncLinear,
  getTasksGitHub,
  syncGitHub,
  hasLinearToken,
  hasGitHubToken,
} from "../lib/api";
import type { Task } from "../lib/api";

export function TasksView() {
  const [linearTasks, setLinearTasks] = useState<Task[]>([]);
  const [githubTasks, setGithubTasks] = useState<Task[]>([]);
  const [hasLinear, setHasLinear] = useState(false);
  const [hasGitHub, setHasGitHub] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doSync = useCallback(async () => {
    setSyncing(true);
    setError(null);

    const syncs: Promise<void>[] = [];

    if (hasLinear) {
      syncs.push(
        syncLinear()
          .then((fresh) => setLinearTasks(fresh))
          .catch((err) => {
            throw typeof err === "string" ? err : "Linear sync failed.";
          })
      );
    }

    if (hasGitHub) {
      syncs.push(
        syncGitHub()
          .then((fresh) => setGithubTasks(fresh))
          .catch((err) => {
            throw typeof err === "string" ? err : "GitHub sync failed.";
          })
      );
    }

    try {
      await Promise.all(syncs);
      setLastSynced(new Date());
    } catch (err) {
      setError(typeof err === "string" ? err : "Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }, [hasLinear, hasGitHub]);

  useEffect(() => {
    // Check which tokens are available, load cached tasks, then sync
    Promise.all([hasLinearToken(), hasGitHubToken()]).then(
      ([linear, github]) => {
        setHasLinear(linear);
        setHasGitHub(github);
      }
    );

    // Load cached tasks immediately
    getTasksLinear()
      .then((cached) => {
        if (cached.length > 0) setLinearTasks(cached);
      })
      .catch(() => {});

    getTasksGitHub()
      .then((cached) => {
        if (cached.length > 0) setGithubTasks(cached);
      })
      .catch(() => {});
  }, []);

  // Trigger sync once we know which tokens exist
  useEffect(() => {
    if (hasLinear || hasGitHub) {
      doSync();
    }
  }, [hasLinear, hasGitHub, doSync]);

  function formatLastSynced(): string {
    if (!lastSynced) return "Syncing...";
    const diffMs = Date.now() - lastSynced.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasklane</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last synced {formatLastSynced()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={doSync}
          disabled={syncing}
          className="gap-1.5"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Linear Section */}
      {hasLinear && (
        <section className="mb-8">
          <div className="mb-3 border-b border-border pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Linear
            </span>
          </div>
          <LinearSection tasks={linearTasks} />
        </section>
      )}

      {/* GitHub Section */}
      <section>
        <div className="mb-3 border-b border-border pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            GitHub
          </span>
        </div>
        <GitHubSection tasks={githubTasks} hasToken={hasGitHub} />
      </section>
    </div>
  );
}
