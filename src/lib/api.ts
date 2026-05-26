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
