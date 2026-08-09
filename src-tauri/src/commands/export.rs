use crate::commands::roadmap::build_roadmap_response;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

#[derive(Debug, Deserialize)]
pub struct ExportRequest {
    pub roadmap_id: String,
    /// "md" | "html"
    pub format: String,
}

#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub content: String,
    pub filename: String,
    pub mime_type: String,
}

/// 导出学习路线 → 返回内容让前端触发浏览器下载
#[tauri::command]
pub async fn export_roadmap(
    state: State<'_, AppState>,
    request: ExportRequest,
) -> Result<ExportResult, String> {
    info!(
        "导出路线 {} → format={}",
        request.roadmap_id, request.format
    );

    let roadmap = {
        let db = state.db.lock().await;
        build_roadmap_response(&db, &request.roadmap_id).await?
    };

    let safe_title = roadmap
        .title
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");

    match request.format.to_lowercase().as_str() {
        "md" | "markdown" => {
            let content = build_markdown(&roadmap);
            Ok(ExportResult {
                content,
                filename: format!("学习路线_{}.md", safe_title),
                mime_type: "text/markdown;charset=utf-8".into(),
            })
        }
        "html" => {
            let content = build_printable_html(&roadmap);
            Ok(ExportResult {
                content,
                filename: format!("学习路线_{}.html", safe_title),
                mime_type: "text/html;charset=utf-8".into(),
            })
        }
        _ => Err(format!("不支持的格式: {}（支持 md / html）", request.format)),
    }
}

fn build_markdown(roadmap: &crate::models::RoadmapResponse) -> String {
    let mut md = String::new();
    let total_tasks: usize = roadmap.stages.iter().map(|s| s.tasks.len()).sum();
    let completed_tasks: usize = roadmap
        .stages
        .iter()
        .flat_map(|s| &s.tasks)
        .filter(|t| t.is_completed)
        .count();

    md.push_str(&format!("# {}\n\n", roadmap.title));
    md.push_str(&format!("*{}*\n\n", roadmap.description));
    md.push_str(&format!(
        "**总阶段:** {} · **总任务:** {} · **已完成:** {} · **预估总时长:** {:.0}h\n\n---\n\n",
        roadmap.stages.len(),
        total_tasks,
        completed_tasks,
        roadmap.estimated_total_hours,
    ));

    for stage in &roadmap.stages {
        md.push_str(&format!(
            "## 第 {} 章 · {}\n\n**目标:** {}\n\n",
            roman_upper(stage.order),
            stage.name,
            stage.objective,
        ));
        if !stage.prerequisites.is_empty() {
            md.push_str(&format!("**前置阶段:** {}\n\n", stage.prerequisites.join("、")));
        }
        if stage.is_fallback {
            md.push_str("> ⚠️ 此阶段为 AI 占位内容\n\n");
        }

        for task in &stage.tasks {
            let status = if task.is_completed { "✅" } else { "☐" };
            md.push_str(&format!(
                "### {} {}.{} {}\n\n",
                status, stage.order, task.order, task.title,
            ));

            if !task.points.is_empty() {
                md.push_str("**要点:**\n\n");
                for p in &task.points {
                    md.push_str(&format!("- {}\n", p));
                }
                md.push('\n');
            }

            if task.content.len() > 10 {
                md.push_str(&task.content);
                md.push_str("\n\n");
            }

            if let Some(ex) = &task.example {
                if !ex.is_empty() {
                    md.push_str(&format!("**示例:**\n\n{}\n\n", ex));
                }
            }

            if !task.resources.is_empty() {
                md.push_str("**学习资源:**\n\n");
                for r in &task.resources {
                    let link = if r.url.is_empty() {
                        r.title.clone()
                    } else {
                        format!("[{}]({})", r.title, r.url)
                    };
                    md.push_str(&format!("- {}\n", link));
                }
                md.push('\n');
            }
            md.push_str("---\n\n");
        }
    }

    md.push_str(&format!(
        "\n\n> 由 RoadmapAI 生成 · {}\n",
        chrono::Utc::now().format("%Y-%m-%d %H:%M")
    ));
    md
}

fn build_printable_html(roadmap: &crate::models::RoadmapResponse) -> String {
    let mut body = String::new();

    body.push_str(&format!(
        r#"<div class="cover">
<h1>{title}</h1>
<p class="subtitle">{desc}</p>
<div class="meta">共 {stages} 章 · {tasks} 项任务 · 预估 {hours:.0}h</div>
</div>"#,
        title = h(&roadmap.title),
        desc = h(&roadmap.description),
        stages = roadmap.stages.len(),
        tasks = roadmap.stages.iter().flat_map(|s| &s.tasks).count(),
        hours = roadmap.estimated_total_hours,
    ));

    for stage in &roadmap.stages {
        let num = roman_upper(stage.order);
        body.push_str(&format!(
            r#"<div class="stage page-break">
<h2>第 {num} 章 · {name}</h2>
<p class="objective">{obj}</p>"#,
            num = num,
            name = h(&stage.name),
            obj = h(&stage.objective),
        ));

        if stage.is_fallback {
            body.push_str(r#"<p class="fallback-note">⚠️ 此阶段为 AI 占位内容</p>"#);
        }

        for task in &stage.tasks {
            let status = if task.is_completed { "✔" } else { "○" };
            body.push_str(&format!(
                r#"<div class="task">
<h3>{status} {sn}.{tn} {title}</h3>"#,
                status = status,
                sn = stage.order,
                tn = task.order,
                title = h(&task.title),
            ));

            if !task.points.is_empty() {
                body.push_str(r#"<ul class="points">"#);
                for p in &task.points {
                    body.push_str(&format!("<li>{}</li>", h(p)));
                }
                body.push_str("</ul>");
            }

            if task.content.len() > 10 {
                body.push_str(&format!(
                    r#"<div class="content">{}</div>"#,
                    simple_md_to_html(&task.content)
                ));
            }

            if let Some(ex) = &task.example {
                if !ex.is_empty() {
                    body.push_str(&format!(r#"<pre class="example">{}</pre>"#, h(ex)));
                }
            }

            if !task.resources.is_empty() {
                body.push_str(r#"<ul class="resources">"#);
                for r in &task.resources {
                    let link = if r.url.is_empty() {
                        h(&r.title)
                    } else {
                        format!(
                            r#"<a href="{url}" target="_blank">{title}</a>"#,
                            url = h(&r.url),
                            title = h(&r.title)
                        )
                    };
                    body.push_str(&format!("<li>{}</li>", link));
                }
                body.push_str("</ul>");
            }
            body.push_str("</div>");
        }
        body.push_str("</div>");
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M");
    body.push_str(&format!(
        r#"<footer><p>由 RoadmapAI 生成 · {now}</p></footer>"#
    ));

    format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>{title}</title><style>
@page{{margin:20mm 18mm;size:A4}}*{{box-sizing:border-box}}
body{{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.8;color:#2d2d2d;max-width:720px;margin:0 auto;padding:0 20px}}
.cover{{text-align:center;padding:60px 0 40px}}
.cover h1{{font-size:28px;font-weight:700;margin-bottom:12px;letter-spacing:2px}}
.cover .subtitle{{font-size:15px;color:#666;font-style:italic;margin-bottom:20px}}
.cover .meta{{font-size:12px;color:#999;border-top:1px solid #ddd;padding-top:16px;margin-top:24px}}
.page-break{{page-break-before:always}}
h2{{font-size:20px;font-weight:700;margin:32px 0 8px;border-bottom:2px solid #c44;padding-bottom:8px;color:#a33}}
.objective{{font-size:14px;color:#555;margin-bottom:16px;font-style:italic}}
.fallback-note{{background:#fff3cd;border-left:3px solid #f0ad4e;padding:8px 12px;font-size:12px;margin-bottom:12px}}
.task{{margin:16px 0 24px;padding:12px 16px;border-left:3px solid #e8e8e8;background:#fafafa;break-inside:avoid}}
.task h3{{font-size:15px;font-weight:600;margin:0 0 8px}}
ul.points,ul.resources{{padding-left:20px;margin:8px 0}}
ul.points li,ul.resources li{{margin-bottom:4px}}
.content{{margin:8px 0}} .content h1,.content h2,.content h3,.content h4{{font-size:14px;margin:8px 0 4px}}
.content p{{margin:4px 0}}
.content code{{background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:12px}}
.content pre{{background:#f5f5f5;padding:10px 14px;border-radius:4px;font-size:12px;overflow-x:auto}}
pre.example{{background:#f0f4f0;border-left:3px solid #5a5;padding:10px 14px;font-size:12px;overflow-x:auto;white-space:pre-wrap;margin:8px 0}}
a{{color:#a33;text-decoration:none}}
footer{{text-align:center;font-size:11px;color:#aaa;margin:40px 0 20px;padding-top:16px;border-top:1px solid #eee}}
@media print{{body{{font-size:11px;color:#000}}.task{{background:none;border-left-color:#ccc}}.fallback-note{{background:none}}a{{color:#000}}}}
</style></head><body>{body}</body></html>"#,
        title = h(&roadmap.title),
        body = body,
    )
}

fn h(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn roman_upper(n: i32) -> String {
    match n {
        1 => "Ⅰ".into(), 2 => "Ⅱ".into(), 3 => "Ⅲ".into(), 4 => "Ⅳ".into(),
        5 => "Ⅴ".into(), 6 => "Ⅵ".into(), 7 => "Ⅶ".into(), 8 => "Ⅷ".into(),
        9 => "Ⅸ".into(), 10 => "Ⅹ".into(), 11 => "Ⅺ".into(), 12 => "Ⅻ".into(),
        13 => "XIII".into(), 14 => "XIV".into(),
        _ => n.to_string(),
    }
}

fn simple_md_to_html(md: &str) -> String {
    let mut out = String::new();
    for line in md.lines() {
        let t = line.trim();
        if t.starts_with("### ") {
            out.push_str(&format!("<h4>{}</h4>", h(&t[4..])));
        } else if t.starts_with("## ") {
            out.push_str(&format!("<h3>{}</h3>", h(&t[3..])));
        } else if t.starts_with("# ") {
            out.push_str(&format!("<h2>{}</h2>", h(&t[2..])));
        } else if t.starts_with("- ") {
            out.push_str(&format!("<li>{}</li>", h(&t[2..])));
        } else if t.starts_with("```") {
            out.push_str(if !out.contains("<pre>") || out.contains("</pre>") {
                "<pre>"
            } else {
                "</pre>"
            });
        } else if t.is_empty() {
            out.push_str("<br>");
        } else {
            out.push_str(&format!("<p>{}</p>", h(t)));
        }
    }
    out
}
