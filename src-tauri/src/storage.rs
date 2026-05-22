use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use std::sync::OnceLock;

const STORE_FILE: &str = ".tasklane-secrets.json";

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn init(app: &AppHandle) -> Result<(), String> {
    APP.set(app.clone())
        .map_err(|_| "Storage already initialized".to_string())
}

pub fn get_token(key: &str) -> Result<Option<String>, String> {
    let app = APP.get().ok_or_else(|| "Storage not initialized".to_string())?;
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    Ok(store.get(key).and_then(|v| v.as_str().map(|s| s.to_string())))
}

pub fn set_token(key: &str, token: &str) -> Result<(), String> {
    let app = APP.get().ok_or_else(|| "Storage not initialized".to_string())?;
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(key.to_string(), serde_json::Value::String(token.to_string()));
    store.save().map_err(|e| e.to_string())
}

#[allow(dead_code)]
pub fn delete_token(key: &str) -> Result<(), String> {
    let app = APP.get().ok_or_else(|| "Storage not initialized".to_string())?;
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.delete(key);
    store.save().map_err(|e| e.to_string())
}
