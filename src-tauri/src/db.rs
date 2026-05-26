use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

const SCHEMA_VERSION: i32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub source: String,
    pub source_id: String,
    pub title: String,
    pub status: Option<String>,
    pub url: String,
    pub assignee: Option<String>,
    pub priority: Option<String>,
    pub updated_at: String,
    pub body_md: Option<String>,
    pub repo: Option<String>,
    pub source_metadata: Option<String>,
}

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("tasklane.db");
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        let db = Db {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Create version table if missing
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);",
        )
        .map_err(|e| e.to_string())?;

        let current: Option<i32> = conn
            .query_row(
                "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .ok();

        if current != Some(SCHEMA_VERSION) {
            // Destructive migration: tasks are just sync cache
            conn.execute_batch(
                "
                DROP TABLE IF EXISTS tasks;
                DELETE FROM schema_version;
                ",
            )
            .map_err(|e| e.to_string())?;

            conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                params![SCHEMA_VERSION],
            )
            .map_err(|e| e.to_string())?;
        }

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL CHECK(source IN ('linear', 'github')),
                source_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT,
                url TEXT NOT NULL,
                assignee TEXT,
                priority TEXT,
                updated_at TEXT NOT NULL,
                body_md TEXT,
                repo TEXT,
                source_metadata TEXT,
                UNIQUE(source, source_id)
            );
            CREATE TABLE IF NOT EXISTS sync_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                source TEXT NOT NULL,
                ok INTEGER,
                error_msg TEXT
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )
        .map_err(|e| e.to_string())
    }

    pub fn upsert_task(
        &self,
        source: &str,
        source_id: &str,
        title: &str,
        status: Option<&str>,
        url: &str,
        assignee: Option<&str>,
        priority: Option<&str>,
        updated_at: &str,
        body_md: Option<&str>,
        repo: Option<&str>,
        source_metadata: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO tasks (source, source_id, title, status, url, assignee, priority, updated_at, body_md, repo, source_metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(source, source_id) DO UPDATE SET
                title = excluded.title,
                status = excluded.status,
                url = excluded.url,
                assignee = excluded.assignee,
                priority = excluded.priority,
                updated_at = excluded.updated_at,
                body_md = excluded.body_md,
                repo = excluded.repo,
                source_metadata = excluded.source_metadata",
            params![source, source_id, title, status, url, assignee, priority, updated_at, body_md, repo, source_metadata],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_tasks_by_source(&self, source: &str) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, source, source_id, title, status, url, assignee, priority, updated_at, body_md, repo, source_metadata
                 FROM tasks WHERE source = ?1 ORDER BY updated_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![source], |row| {
                Ok(Task {
                    id: row.get(0)?,
                    source: row.get(1)?,
                    source_id: row.get(2)?,
                    title: row.get(3)?,
                    status: row.get(4)?,
                    url: row.get(5)?,
                    assignee: row.get(6)?,
                    priority: row.get(7)?,
                    updated_at: row.get(8)?,
                    body_md: row.get(9)?,
                    repo: row.get(10)?,
                    source_metadata: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut tasks = Vec::new();
        for row in rows {
            tasks.push(row.map_err(|e| e.to_string())?);
        }
        Ok(tasks)
    }

    pub fn delete_tasks_by_source(&self, source: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM tasks WHERE source = ?1", params![source])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn record_sync_start(&self, source: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_runs (started_at, source) VALUES (datetime('now'), ?1)",
            params![source],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn record_sync_finish(&self, run_id: i64, ok: bool, error_msg: Option<&str>) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_runs SET finished_at = datetime('now'), ok = ?1, error_msg = ?2 WHERE id = ?3",
            params![ok as i32, error_msg, run_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );
        match result {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_last_successful_sync(&self, source: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let result = conn.query_row(
            "SELECT finished_at FROM sync_runs WHERE source = ?1 AND ok = 1 ORDER BY finished_at DESC LIMIT 1",
            params![source],
            |row| row.get(0),
        );
        match result {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn is_sync_in_progress(&self, source: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_runs WHERE source = ?1 AND finished_at IS NULL",
                params![source],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(count > 0)
    }
}
