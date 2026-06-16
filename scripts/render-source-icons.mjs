// 一次性脚本：把两个源 SVG 渲染成 1024×1024 PNG 源文件
// 用完即删（脚本本身），@resvg/resvg-js 是 --no-save 安装的，不污染依赖
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

const sources = [
  { svg: 'src-tauri/icons/source-manuscript.svg', png: 'src-tauri/icons/source-manuscript.png' },
  { svg: 'src-tauri/icons/source-modern.svg',      png: 'src-tauri/icons/source-modern.png' },
];

for (const { svg, png } of sources) {
  const svgText = fs.readFileSync(svg, 'utf8');
  const resvg = new Resvg(svgText, {
    fitTo: { mode: 'width', value: 1024 },
    background: 'transparent',
    font: { loadSystemFonts: true, defaultFontFamily: 'Newsreader' },
  });
  const out = resvg.render().asPng();
  fs.writeFileSync(png, out);
  console.log(`✓ ${svg} → ${png}  (${out.length} bytes)`);
}
