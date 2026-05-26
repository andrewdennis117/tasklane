mod db;
mod storage;
mod linear;
mod github;

use db::{Db, Task};
use std::sync::OnceLock;
use tauri::Manager;

static DB: OnceLock<Db> = OnceLock::new();

fn get_db() -> Result<&'static Db, String> {
    DB.get().ok_or_else(|| "Database not initialized".to_string())
}

#[tauri::command]
async fn set_linear_token(token: String) -> Result<(), String> {
    // Validate by making a test API call
    let issues = linear::fetch_assigned_issues(&token).await?;
    // If we get here, the token is valid
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
async fn sync_linear() -> Result<Vec<Task>, String> {
    let db = get_db()?;
    let token = storage::get_token("linear_api_key")?
        .ok_or_else(|| "No Linear API key configured".to_string())?;

    let run_id = db.record_sync_start("linear")?;

    match linear::fetch_assigned_issues(&token).await {
        Ok(issues) => {
            // Clear old linear tasks and insert fresh ones
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

#[tauri::command]
async fn get_tasks_linear() -> Result<Vec<Task>, String> {
    let db = get_db()?;
    db.get_tasks_by_source("linear")
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

#[tauri::command]
async fn sync_github() -> Result<Vec<Task>, String> {
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
                    Some(&issue.repo),
                    if issue.priority_label.is_empty() {
                        None
                    } else {
                        Some(&issue.priority_label)
                    },
                    &issue.updated_at,
                    issue.body.as_deref(),
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

#[tauri::command]
async fn get_tasks_github() -> Result<Vec<Task>, String> {
    let db = get_db()?;
    db.get_tasks_by_source("github")
}

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
