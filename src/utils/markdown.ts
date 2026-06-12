import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

export { lowlight };

/**
 * 清洗 AI 输出的 markdown。
 * react-markdown 默认不会把字面 "\n" / 孤立的 "###" 转成换行或标题,
 * 会以可见字符串渲染。这里做兜底,让普通段落可读、孤立的井号变回字面文字。
 *
 * 关键处理:把不属于 markdown 语法但容易被误解析的 token
 * (如 Rust `#[repr(C)]?`、闭包 `[T]`、可选 `?`)做转义,
 * 避免 react-markdown 把它们当作 link/heading/emphasis 解析出残段。
 * 用转义而不是包成 inline code,保留原文视觉。
 */
export const sanitizeMarkdown = (raw: string): string => {
  if (!raw) return '';
  let s = raw
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 把疑似 markdown 链接语法的 `#[attr]?` 转义,免得被解析成 "link 缺 URL"
  // 例: #[repr(C)]?  #[derive(Debug)]  #[inline]  #[test]
  s = s.replace(/(?<=[\s,;:(])#(\[)([^\]]+)(\]\??)/g, '\\$1$2$3');
  // 把行内看起来像 link 语法的 `[T]` `[T; N]` 转义(后接非 `(` 才转义,正常 `[text](url)` 不动)
  s = s.replace(/(?<=[\s,:;.(])\[([A-Za-z_][^\]\n]*?)\](?!\()/g, '\\[$1\\]');
  // 行首孤立的 "###" 后无空格,补上空格让 markdown 仍能解析
  s = s.replace(/^(\s*)###(?=\S)/gm, '$1### ');
  return s;
};

/**
 * 提取纯文本摘要(用于收藏 / 卡片预览等不支持 markdown 渲染的场景)。
 * - 去掉字面 "\n" / "\t" 等转义
 * - 去掉 markdown 标记字符(`#` `*` `_` `` ` `` `>` `~` `[` `]` `(` `)` 等)
 * - 把所有空白折叠为单个空格
 */
export const toPlainText = (raw: string, maxLen = 200): string => {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/[`*_~#>]/g, '')               // 抹掉行内 / 块级标记字符
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')// ![alt](url) → alt
    .replace(/^#{1,6}\s*/gm, '')            // 标题前缀
    .replace(/^\s*[-*+]\s+/gm, '')          // 列表前缀
    .replace(/^\s*\d+\.\s+/gm, '')          // 有序列表前缀
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen).trimEnd() + '…';
};
