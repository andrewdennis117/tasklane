import { invoke } from "@tauri-apps/api/core";

export interface Task {
  id: number;
  source: string;
  source_id: string;
  title: string;
  status: string | null;
  url: string;
  assignee: string | null;
  priority: string | null;
  updated_at: string;
  body_md: string | null;
  repo: string | null;
  source_metadata: string | null;
}

export interface SyncStatus {
  linear: string | null;
  github: string | null;
  linear_in_progress: boolean;
  github_in_progress: boolean;
}

export const setLinearToken = (token: string) =>
  invoke<void>("set_linear_token", { token });

export const hasLinearToken = () =>
  invoke<boolean>("has_linear_token");

export const syncLinear = () =>
  invoke<Task[]>("sync_linear");

export const getTasksLinear = () =>
  invoke<Task[]>("get_tasks_linear");

export const setGitHubToken = (token: string) =>
  invoke<void>("set_github_token", { token });

export const hasGitHubToken = () =>
  invoke<boolean>("has_github_token");

export const syncGitHub = () =>
  invoke<Task[]>("sync_github");

export const getTasksGitHub = () =>
  invoke<Task[]>("get_tasks_github");

export const getSyncStatus = () =>
  invoke<SyncStatus>("get_sync_status");

export const getSyncIntervalHours = () =>
  invoke<number>("get_sync_interval_hours");

export const setSyncIntervalHours = (hours: number) =>
  invoke<void>("set_sync_interval_hours", { hours });
