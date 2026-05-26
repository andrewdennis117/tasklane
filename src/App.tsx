import { useEffect, useState } from "react";
import { SettingsView } from "./components/SettingsView";
import { TasksView } from "./components/TasksView";
import { hasLinearToken, hasGitHubToken } from "./lib/api";

type View = "loading" | "settings" | "tasks";

function App() {
  const [view, setView] = useState<View>("loading");

  useEffect(() => {
    Promise.all([hasLinearToken(), hasGitHubToken()])
      .then(([hasLinear, hasGitHub]) =>
        setView(hasLinear || hasGitHub ? "tasks" : "settings")
      )
      .catch(() => setView("settings"));
  }, []);

  if (view === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (view === "settings") {
    return <SettingsView onConnected={() => setView("tasks")} />;
  }

  return <TasksView />;
}

export default App;
