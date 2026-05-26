use serde::{Deserialize, Serialize};

const SEARCH_URL: &str = "https://api.github.com/search/issues";
const USER_AGENT: &str = "tasklane-app";

#[derive(Debug, Deserialize)]
struct SearchResponse {
    items: Vec<GitHubItem>,
}

#[derive(Debug, Deserialize)]
struct GitHubItem {
    number: u64,
    title: String,
    state: String,
    html_url: String,
    updated_at: String,
    body: Option<String>,
    repository_url: String,
    pull_request: Option<serde_json::Value>,
    labels: Vec<GitHubLabel>,
}

#[derive(Debug, Deserialize)]
struct GitHubLabel {
    name: String,
}

#[derive(Debug, Serialize)]
pub struct GitHubIssue {
    pub identifier: String,
    pub number: u64,
    pub title: String,
    pub state: String,
    pub url: String,
    pub updated_at: String,
    pub body: Option<String>,
    pub repo: String,
    pub is_pr: bool,
    pub priority_label: String,
}

pub async fn fetch_assigned_issues_and_prs(token: &str) -> Result<Vec<GitHubIssue>, String> {
    let client = reqwest::Client::new();
    let query = "is:open assignee:@me";
    let url = format!(
        "{}?q={}&per_page=100&sort=updated&order=desc",
        SEARCH_URL,
        urlencoding::encode(query)
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    let data: SearchResponse = resp.json().await.map_err(|e| e.to_string())?;

    Ok(data
        .items
        .into_iter()
        .map(|item| {
            let repo = item
                .repository_url
                .replace("https://api.github.com/repos/", "");
            let identifier = format!("{}#{}", repo, item.number);
            let is_pr = item.pull_request.is_some();
            let priority_label = item
                .labels
                .iter()
                .find(|l| l.name.starts_with("priority/"))
                .map(|l| l.name.clone())
                .unwrap_or_default();
            GitHubIssue {
                identifier,
                number: item.number,
                title: item.title,
                state: item.state,
                url: item.html_url,
                updated_at: item.updated_at,
                body: item.body,
                repo,
                is_pr,
                priority_label,
            }
        })
        .collect())
}
