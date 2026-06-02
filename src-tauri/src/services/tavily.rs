use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::info;
use crate::services::parallel::ResourceDetail;

const TAVILY_URL: &str = "https://api.tavily.com/search";

#[derive(Debug, Serialize)]
struct TavilyRequest {
    api_key: String,
    query: String,
    search_depth: String,
    include_answer: bool,
    max_results: u32,
}

#[derive(Debug, Deserialize)]
struct TavilyResponse {
    results: Vec<TavilyResult>,
}

#[derive(Debug, Deserialize)]
struct TavilyResult {
    title: String,
    url: String,
    content: String,
}

fn map_resource_type(url: &str) -> String {
    let url_lower = url.to_lowercase();
    if url_lower.contains("youtube.com") || url_lower.contains("bilibili.com") || url_lower.contains("youtu.be") {
        "video".to_string()
    } else if url_lower.contains("docs.") || url_lower.contains("/docs/") || url_lower.contains("documentation") {
        "documentation".to_string()
    } else if url_lower.contains("course") || url_lower.contains("udemy") || url_lower.contains("coursera") || url_lower.contains("imooc") {
        "course".to_string()
    } else {
        "article".to_string()
    }
}

pub async fn search_resources(
    client: &Client,
    api_key: &str,
    query: &str,
    max_results: u32,
) -> Result<Vec<ResourceDetail>, String> {
    let request = TavilyRequest {
        api_key: api_key.to_string(),
        query: query.to_string(),
        search_depth: "basic".to_string(),
        include_answer: false,
        max_results,
    };

    let resp = client
        .post(TAVILY_URL)
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Tavily 请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("Tavily API 错误 ({}): {}", status, err_text));
    }

    let body: TavilyResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析 Tavily 响应失败: {}", e))?;

    info!("Tavily 搜索「{}」返回 {} 条结果", query, body.results.len());

    let resources: Vec<ResourceDetail> = body
        .results
        .into_iter()
        .filter(|r| !r.url.is_empty() && !r.title.is_empty())
        .map(|r| {
            let resource_type = map_resource_type(&r.url);
            ResourceDetail {
                title: r.title,
                url: r.url,
                snippet: Some(if r.content.len() > 200 {
                    format!("{}...", &r.content[..200])
                } else {
                    r.content
                }),
                resource_type,
            }
        })
        .collect();

    Ok(resources)
}

pub fn build_search_query(topic: &str, task_title: &str, task_type: &str) -> String {
    let type_hint = match task_type {
        "video" => " 教程 视频",
        "exercise" => " 练习题 示例",
        "project" => " 项目实战 教程",
        _ => " 教程",
    };
    format!("{} {} {}", topic, task_title, type_hint)
}
