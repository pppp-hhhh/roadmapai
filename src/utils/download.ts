import { invoke } from '@tauri-apps/api/core';

export interface ExportRequest {
  roadmap_id: string;
  format: 'md' | 'html';
}

export interface ExportResult {
  content: string;
  filename: string;
  mime_type: string;
}

/**
 * 导出学习路线 → 触发浏览器下载。
 * 纯前端 Blob 下载，不依赖 tauri-plugin-dialog。
 */
export async function downloadRoadmap(request: ExportRequest): Promise<void> {
  const result = await invoke<ExportResult>('export_roadmap', {
    request: {
      roadmap_id: request.roadmap_id,
      format: request.format,
    },
  });

  const blob = new Blob([result.content], { type: result.mime_type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 延迟回收 URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
