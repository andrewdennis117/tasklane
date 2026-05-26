import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { setLinearToken, setGitHubToken } from "../lib/api";

interface SettingsViewProps {
  onConnected: () => void;
}

type Step = "linear" | "github";

export function SettingsView({ onConnected }: SettingsViewProps) {
  const [step, setStep] = useState<Step>("linear");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLinearSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await setLinearToken(token.trim());
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

  async function handleGitHubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await setGitHubToken(token.trim());
      onConnected();
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

  if (step === "linear") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-[420px]">
          <CardHeader>
            <CardTitle className="text-xl">Welcome to Tasklane</CardTitle>
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
          <CardTitle className="text-xl">Add GitHub (Optional)</CardTitle>
          <CardDescription>
            Connect GitHub to see your assigned issues and PRs across all repos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGitHubSubmit} className="space-y-4">
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

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onConnected()}
                disabled={loading}
              >
                Skip
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !token.trim()}
              >
                {loading ? "Connecting..." : "Save and Connect"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
