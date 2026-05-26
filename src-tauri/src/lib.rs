mod db;
mod storage;
mod linear;
mod github;

use db::{Db, Task};
use serde::Serialize;
use std::sync::OnceLock;
use tauri::{Emitter, Manager};

static DB: OnceLock<Db> = OnceLock::new();

fn get_db() -> Result<&'static Db, String> {
    DB.get().ok_or_else(|| "Database not initialized".to_string())
}

// --- Sync helpers (shared by Tauri commands and background loop) ---

async fn do_sync_linear() -> Result<Vec<Task>, String> {
    let db = get_db()?;
    let token = storage::get_token("linear_api_key")?
        .ok_or_else(|| "No Linear API key configured".to_string())?;

    let run_id = db.record_sync_start("linear")?;

    match linear::fetch_assigned_issues(&token).await {
        Ok(issues) => {
            db.delete_tasks_by_source("linear")?;
            for issue in &issues {
                db.upsert_task(
                    "linear",
                    &issue.identifier,
                    &issue.title,
                    Some(&issue.state_name),
                    &issue.url,
                    None,
                    Some(&issue.priority_label),
                    &issue.updated_at,
                    issue.description.as_deref(),
                    None,
                    Some(&issue.source_metadata),
                )?;
            }
            db.record_sync_finish(run_id, true, None)?;
            db.get_tasks_by_source("linear")
        }
        Err(e) => {
            db.record_sync_finish(run_id, false, Some(&e))?;
            Err(e)
        }
    }
}

async fn do_sync_github() -> Result<Vec<Task>, String> {
    let db = get_db()?;
    let token = storage::get_token("github_pat")?
        .ok_or_else(|| "No GitHub token configured".to_string())?;

    let run_id = db.record_sync_start("github")?;

    match github::fetch_assigned_issues_and_prs(&token).await {
        Ok(issues) => {
            db.delete_tasks_by_source("github")?;
            for issue in &issues {
                db.upsert_task(
                    "github",
                    &issue.identifier,
                    &issue.title,
                    Some(&issue.state),
                    &issue.url,
                    None,
                    if issue.priority_label.is_empty() {
                        None
                    } else {
                        Some(&issue.priority_label)
                    },
                    &issue.updated_at,
                    issue.body.as_deref(),
                    Some(&issue.repo),
                    Some(&issue.source_metadata),
                )?;
            }
            db.record_sync_finish(run_id, true, None)?;
            db.get_tasks_by_source("github")
        }
        Err(e) => {
            db.record_sync_finish(run_id, false, Some(&e))?;
            Err(e)
        }
    }
}

fn get_sync_interval_hours_inner() -> Result<u64, String> {
    let db = get_db()?;
    Ok(db
        .get_setting("sync_interval_hours")?
        .and_then(|v| v.parse().ok())
        .unwrap_or(2))
}

// --- Background sync loop ---

async fn run_background_sync_loop(app: tauri::AppHandle) {
    // Small delay so the app finishes startup before first sync fires
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    loop {
        let interval_hours = get_sync_interval_hours_inner().unwrap_or(2);
        let interval_secs = interval_hours.saturating_mul(3600).max(60);

        // Fire sync for each source; failures don't stop the loop
        if storage::get_token("linear_api_key").ok().flatten().is_some() {
            let _ = do_sync_linear().await;
        }
        if storage::get_token("github_pat").ok().flatten().is_some() {
            let _ = do_sync_github().await;
        }

        // Notify frontend that sync completed
        let _ = app.emit("tasks-synced", ());

        tokio::time::sleep(std::time::Duration::from_secs(interval_secs)).await;
    }
}

// --- Tauri commands: token management ---

#[tauri::command]
async fn set_linear_token(token: String) -> Result<(), String> {
    let issues = linear::fetch_assigned_issues(&token).await?;
    let _ = issues;
    storage::set_token("linear_api_key", &token)?;
    Ok(())
}

#[tauri::command]
async fn has_linear_token() -> Result<bool, String> {
    let token = storage::get_token("linear_api_key")?;
    Ok(token.is_some())
}

#[tauri::command]
async fn set_github_token(token: String) -> Result<(), String> {
    let _ = github::fetch_assigned_issues_and_prs(&token).await?;
    storage::set_token("github_pat", &token)?;
    Ok(())
}

#[tauri::command]
async fn has_github_token() -> Result<bool, String> {
    let token = storage::get_token("github_pat")?;
    Ok(token.is_some())
}

// --- Tauri commands: sync ---

#[tauri::command]
async fn sync_linear() -> Result<Vec<Task>, String> {
    do_sync_linear().await
}

#[tauri::command]
async fn sync_github() -> Result<Vec<Task>, String> {
    do_sync_github().await
}

#[tauri::command]
async fn get_tasks_linear() -> Result<Vec<Task>, String> {
    let db = get_db()?;
    db.get_tasks_by_source("linear")
}

#[tauri::command]
async fn get_tasks_github() -> Result<Vec<Task>, String> {
    let db = get_db()?;
    db.get_tasks_by_source("github")
}

// --- Tauri commands: sync status + interval ---

#[derive(Serialize)]
struct SyncStatus {
    linear: Option<String>,
    github: Option<String>,
    linear_in_progress: bool,
    github_in_progress: bool,
}

#[tauri::command]
async fn get_sync_status() -> Result<SyncStatus, String> {
    let db = get_db()?;
    Ok(SyncStatus {
        linear: db.get_last_successful_sync("linear")?,
        github: db.get_last_successful_sync("github")?,
        linear_in_progress: db.is_sync_in_progress("linear")?,
        github_in_progress: db.is_sync_in_progress("github")?,
    })
}

#[tauri::command]
async fn get_sync_interval_hours() -> Result<u64, String> {
    get_sync_interval_hours_inner()
}

#[tauri::command]
async fn set_sync_interval_hours(hours: u64) -> Result<(), String> {
    if hours < 1 || hours > 24 {
        return Err("Interval must be 1-24 hours".to_string());
    }
    let db = get_db()?;
    db.set_setting("sync_interval_hours", &hours.to_string())
}

// --- App entry point ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            storage::init(&app.handle())?;

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
            let db = Db::new(app_data_dir)
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            DB.set(db)
                .map_err(|_| "Database already initialized")
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                run_background_sync_loop(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_linear_token,
            has_linear_token,
            sync_linear,
            get_tasks_linear,
            set_github_token,
            has_github_token,
            sync_github,
            get_tasks_github,
            get_sync_status,
            get_sync_interval_hours,
            set_sync_interval_hours,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
