use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinearIssue {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub url: String,
    pub updated_at: String,
    pub state_name: String,
    pub state_type: String,
    pub priority_label: String,
    pub description: Option<String>,
    pub source_metadata: String,
}

#[derive(Deserialize)]
struct GqlResponse {
    data: Option<GqlData>,
    errors: Option<Vec<GqlError>>,
}

#[derive(Deserialize)]
struct GqlError {
    message: String,
}

#[derive(Deserialize)]
struct GqlData {
    viewer: Viewer,
}

#[derive(Deserialize)]
struct Viewer {
    #[serde(rename = "assignedIssues")]
    assigned_issues: IssueConnection,
}

#[derive(Deserialize)]
struct IssueConnection {
    nodes: Vec<IssueNode>,
}

#[derive(Deserialize)]
struct IssueNode {
    id: String,
    identifier: String,
    title: String,
    url: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    state: IssueState,
    #[allow(dead_code)]
    priority: f64,
    #[serde(rename = "priorityLabel")]
    priority_label: String,
    description: Option<String>,
}

#[derive(Deserialize)]
struct IssueState {
    name: String,
    #[serde(rename = "type")]
    state_type: String,
}

const GRAPHQL_QUERY: &str = r#"
query {
    viewer {
        assignedIssues(
            filter: { state: { type: { nin: ["completed", "canceled"] } } }
            first: 100
            orderBy: updatedAt
        ) {
            nodes {
                id
                identifier
                title
                url
                updatedAt
                state { name type }
                priority
                priorityLabel
                description
            }
        }
    }
}
"#;

pub async fn fetch_assigned_issues(token: &str) -> Result<Vec<LinearIssue>, String> {
    let client = Client::new();
    let body = serde_json::json!({ "query": GRAPHQL_QUERY });

    let resp = client
        .post("https://api.linear.app/graphql")
        .header("Authorization", token)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Linear API request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Linear API returned status {}", resp.status()));
    }

    let gql: GqlResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Linear response: {}", e))?;

    if let Some(errors) = gql.errors {
        let msgs: Vec<String> = errors.into_iter().map(|e| e.message).collect();
        return Err(format!("Linear GraphQL errors: {}", msgs.join(", ")));
    }

    let data = gql.data.ok_or("No data in Linear response")?;
    let issues = data
        .viewer
        .assigned_issues
        .nodes
        .into_iter()
        .map(|n| {
            let source_metadata = serde_json::json!({
                "priority_label": &n.priority_label,
                "state_type": &n.state.state_type,
            }).to_string();
            LinearIssue {
                id: n.id,
                identifier: n.identifier,
                title: n.title,
                url: n.url,
                updated_at: n.updated_at,
                state_name: n.state.name,
                state_type: n.state.state_type,
                priority_label: n.priority_label,
                description: n.description,
                source_metadata,
            }
        })
        .collect();

    Ok(issues)
}
