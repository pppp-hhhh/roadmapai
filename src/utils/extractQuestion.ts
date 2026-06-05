/**
 * 从 AI 回答中启发式提取一个问题。
 * 匹配"什么是 X" / "X 是什么" / "X 的含义"等句式,失败则取首行前 50 字。
 */
export function extractQuestion(content: string): string {
  const patterns = [
    /(?:^|\n)[#*]?\s*(什么是.{2,30}[?？])/,
    /(?:^|\n)[#*]?\s*(.{2,30}是什么[?？])/,
    /(?:^|\n)[#*]?\s*(.{2,30}的含义[?？]?)/,
    /(?:^|\n)[#*]?\s*(如何.{2,30}[?？])/,
    /(?:^|\n)[#*]?\s*(为什么.{2,30}[?？])/,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (m && m[1]) {
      return m[1].replace(/^#+\s*/, '').trim();
    }
  }
  const firstLine = content.split('\n').find((l) => l.trim().length > 0) || '';
  return firstLine.replace(/^[#*\-]+\s*/, '').slice(0, 50);
}

/** 提取回答的纯文本摘要(用于收藏预览) */
export function extractPreview(content: string, max = 120): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*`>_~\-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}
