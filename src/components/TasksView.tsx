import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
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
  getSyncStatus,
} from "../lib/api";
import type { Task, SyncStatus } from "../lib/api";

function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp + "Z");
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function TasksView() {
  const [linearTasks, setLinearTasks] = useState<Task[]>([]);
  const [githubTasks, setGithubTasks] = useState<Task[]>([]);
  const [hasLinear, setHasLinear] = useState(false);
  const [hasGitHub, setHasGitHub] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const loadTasks = useCallback(async () => {
    const [linear, github] = await Promise.all([
      getTasksLinear().catch(() => [] as Task[]),
      getTasksGitHub().catch(() => [] as Task[]),
    ]);
    setLinearTasks(linear);
    setGithubTasks(github);
  }, []);

  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch {
      // ignore
    }
  }, []);

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
    } catch (err) {
      setError(
        typeof err === "string" ? err : "Sync failed. Please try again."
      );
    } finally {
      setSyncing(false);
      refreshSyncStatus();
    }
  }, [hasLinear, hasGitHub, refreshSyncStatus]);

  useEffect(() => {
    // Check which tokens are available, load cached tasks, then sync
    Promise.all([hasLinearToken(), hasGitHubToken()]).then(
      ([linear, github]) => {
        setHasLinear(linear);
        setHasGitHub(github);
      }
    );

    loadTasks();
    refreshSyncStatus();
  }, [loadTasks, refreshSyncStatus]);

  // Trigger sync once we know which tokens exist
  useEffect(() => {
    if (hasLinear || hasGitHub) {
      doSync();
    }
  }, [hasLinear, hasGitHub, doSync]);

  // Listen for background sync events
  useEffect(() => {
    const unlisten = listen("tasks-synced", () => {
      loadTasks();
      refreshSyncStatus();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadTasks, refreshSyncStatus]);

  // Poll sync status every 30s to keep timestamps fresh
  useEffect(() => {
    const id = setInterval(refreshSyncStatus, 30_000);
    return () => clearInterval(id);
  }, [refreshSyncStatus]);

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasklane</h1>
          {/* Per-source sync status */}
          <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
            {hasLinear && (
              <span>
                Linear:{" "}
                {syncStatus?.linear_in_progress ? (
                  <span className="text-primary">syncing...</span>
                ) : syncStatus?.linear ? (
                  formatRelativeTime(syncStatus.linear)
                ) : (
                  "never"
                )}
              </span>
            )}
            {hasGitHub && (
              <span>
                GitHub:{" "}
                {syncStatus?.github_in_progress ? (
                  <span className="text-primary">syncing...</span>
                ) : syncStatus?.github ? (
                  formatRelativeTime(syncStatus.github)
                ) : (
                  "never"
                )}
              </span>
            )}
          </div>
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
