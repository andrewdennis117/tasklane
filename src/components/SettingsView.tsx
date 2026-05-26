import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  setLinearToken,
  setGitHubToken,
  hasLinearToken,
  hasGitHubToken,
  getSyncIntervalHours,
  setSyncIntervalHours,
} from "../lib/api";

interface SettingsViewProps {
  onConnected: () => void;
  onBack?: () => void;
}

type Step = "loading" | "linear" | "github";

export function SettingsView({ onConnected, onBack }: SettingsViewProps) {
  const [step, setStep] = useState<Step>("loading");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncInterval, setSyncInterval] = useState("2");
  const [linearConnected, setLinearConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);

  useEffect(() => {
    Promise.all([
      hasLinearToken(),
      hasGitHubToken(),
      getSyncIntervalHours().catch(() => 2),
    ]).then(([hasLinear, hasGitHub, interval]) => {
      setLinearConnected(hasLinear);
      setGithubConnected(hasGitHub);
      setSyncInterval(String(interval));
      // Skip to the right step based on what's already configured
      if (hasLinear) {
        setStep("github");
      } else {
        setStep("linear");
      }
    });
  }, []);

  // Whether we can show a back button (at least one token exists)
  const canGoBack = linearConnected || githubConnected;

  async function handleLinearSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await setLinearToken(token.trim());
      setLinearConnected(true);
      setToken("");
      setStep("github");
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : "Failed to validate Linear API key. Please check and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveIntervalAndFinish() {
    const hours = parseInt(syncInterval, 10);
    if (hours >= 1 && hours <= 24) {
      await setSyncIntervalHours(hours).catch(() => {});
    }
    onConnected();
  }

  async function handleGitHubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await setGitHubToken(token.trim());
      setGithubConnected(true);
      await saveIntervalAndFinish();
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : "Failed to validate GitHub token. Check scopes and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (step === "linear") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-[420px]">
          <CardHeader>
            {canGoBack && onBack && (
              <button
                onClick={onBack}
                className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to tasks
              </button>
            )}
            <CardTitle className="text-xl">
              {canGoBack ? "Settings" : "Welcome to Tasklane"}
            </CardTitle>
            <CardDescription>
              Connect your Linear account to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLinearSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="linear-key"
                  className="text-sm font-medium text-foreground"
                >
                  Linear API Key
                </label>
                <Input
                  id="linear-key"
                  type="password"
                  placeholder="lin_api_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Create a personal API key at{" "}
                  <a
                    href="https://linear.app/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    linear.app/settings/api
                  </a>
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !token.trim()}
              >
                {loading ? "Connecting..." : "Save and Connect"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[420px]">
        <CardHeader>
          {canGoBack && onBack && (
            <button
              onClick={onBack}
              className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to tasks
            </button>
          )}
          <CardTitle className="text-xl">
            {githubConnected ? "Settings" : "Add GitHub (Optional)"}
          </CardTitle>
          <CardDescription>
            {githubConnected
              ? "Manage your connections and sync settings."
              : "Connect GitHub to see your assigned issues and PRs across all repos."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGitHubSubmit} className="space-y-4">
            {/* Connection status */}
            {linearConnected && (
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Linear connected</span>
              </div>
            )}
            {githubConnected && (
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">
                  GitHub connected
                </span>
              </div>
            )}

            {!githubConnected && (
              <div className="space-y-2">
                <label
                  htmlFor="github-token"
                  className="text-sm font-medium text-foreground"
                >
                  GitHub Personal Access Token
                </label>
                <Input
                  id="github-token"
                  type="password"
                  placeholder="github_pat_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Create a fine-grained token with <strong>Issues</strong> and{" "}
                  <strong>Pull requests</strong> read access at{" "}
                  <a
                    href="https://github.com/settings/personal-access-tokens/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    github.com/settings/tokens
                  </a>
                </p>
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <label
                htmlFor="sync-interval"
                className="text-sm font-medium text-foreground"
              >
                Background sync interval
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="sync-interval"
                  type="number"
                  min={1}
                  max={24}
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value)}
                  className="w-20"
                  disabled={loading}
                />
                <span className="text-sm text-muted-foreground">
                  hours (1-24)
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {githubConnected ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => saveIntervalAndFinish()}
                disabled={loading}
              >
                Save
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => saveIntervalAndFinish()}
                  disabled={loading}
                >
                  {canGoBack ? "Done" : "Skip"}
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !token.trim()}
                >
                  {loading ? "Connecting..." : "Save and Connect"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
