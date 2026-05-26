use serde::{Deserialize, Serialize};

const SEARCH_URL: &str = "https://api.github.com/search/issues";
const USER_AGENT: &str = "tasklane-app";
const MAX_RESULTS: usize = 500;

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
    pub source_metadata: String,
}

fn parse_next_link(header: &str) -> Option<String> {
    for part in header.split(',') {
        let part = part.trim();
        if part.ends_with("rel=\"next\"") {
            // Extract URL between < and >
            if let Some(start) = part.find('<') {
                if let Some(end) = part.find('>') {
                    return Some(part[start + 1..end].to_string());
                }
            }
        }
    }
    None
}

fn convert_items(items: Vec<GitHubItem>) -> Vec<GitHubIssue> {
    items
        .into_iter()
        .map(|item| {
            let repo = item
                .repository_url
                .replace("https://api.github.com/repos/", "");
            let identifier = format!("{}#{}", repo, item.number);
            let is_pr = item.pull_request.is_some();
            let label_names: Vec<&str> = item.labels.iter().map(|l| l.name.as_str()).collect();
            let priority_label = item
                .labels
                .iter()
                .find(|l| l.name.starts_with("priority/"))
                .map(|l| l.name.clone())
                .unwrap_or_default();
            let source_metadata = serde_json::json!({
                "is_pr": is_pr,
                "labels": label_names,
            })
            .to_string();
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
                source_metadata,
            }
        })
        .collect()
}

pub async fn fetch_assigned_issues_and_prs(token: &str) -> Result<Vec<GitHubIssue>, String> {
    let client = reqwest::Client::new();
    let query = "is:open assignee:@me";
    let mut next_url: Option<String> = Some(format!(
        "{}?q={}&per_page=100&sort=updated&order=desc",
        SEARCH_URL,
        urlencoding::encode(query)
    ));
    let mut all_issues: Vec<GitHubIssue> = Vec::new();

    while let Some(url) = next_url.take() {
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

        // Extract Link header before consuming the response body
        let link_header = resp
            .headers()
            .get("link")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let data: SearchResponse = resp.json().await.map_err(|e| e.to_string())?;
        all_issues.extend(convert_items(data.items));

        // Stop if we hit the safety cap
        if all_issues.len() >= MAX_RESULTS {
            all_issues.truncate(MAX_RESULTS);
            break;
        }

        // Follow next page if available
        next_url = link_header.as_deref().and_then(parse_next_link);
    }

    Ok(all_issues)
}
