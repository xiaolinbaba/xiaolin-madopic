# Madopic - Markdown to Picture

Madopic 是由 XIAOLIN AI LAB 出品的在线 Markdown to picture 工具。它可以将 Markdown 内容转换成精美图片海报，适合制作 Markdown 海报、社交媒体长图、知识卡片、技术说明图、公式图表海报和数据展示图片。

官网：<https://madopic.thus.chat/>

开源仓库：<https://github.com/xiaolinbaba/Madopic>

## 主要功能

- Markdown 实时编辑和预览。
- 自定义背景、字体大小、内容宽度和卡片边距。
- 支持自由模式、小红书 3:4 模式和朋友圈长图模式。
- 导出 PNG 图片。
- 导出 PDF 文档。
- 导出独立 HTML 文件。
- 支持本地图片、剪贴板图片和网络图片。
- 支持 Mermaid 流程图、序列图、甘特图和饼图。
- 支持 ECharts 数据图表。
- 支持 KaTeX 数学公式和 mhchem 化学公式。
- 支持代码高亮和信息卡片。
- 支持浏览器本地草稿自动保存。

## 适用场景

Madopic 适合已经习惯用 Markdown 写内容、但需要图片化输出的用户。

常见场景包括：

- 社交媒体知识海报。
- 小红书 Markdown 卡片。
- 朋友圈长图。
- 技术文档图片。
- 架构图和流程说明。
- 教学课件和学习笔记。
- 学术公式和科研图表。
- 商业报告和项目进度展示。

## 技术组成

Madopic 是一个静态前端项目，主要使用原生 HTML、CSS 和 JavaScript 实现。

核心依赖包括：

- marked.js 用于 Markdown 解析。
- html2canvas 用于图片导出。
- jsPDF 用于直接下载 PDF，正文使用可选择和编辑的真实文本对象。
- KaTeX 和 mhchem 用于数学、化学公式渲染。
- Mermaid 用于图表渲染。
- Apache ECharts 用于数据可视化。
- Prism.js 用于代码高亮。
- Font Awesome 用于界面图标。

## 项目定位

Madopic 的目标不是替代完整设计软件，而是让 Markdown 内容快速变成可分享、可导出的视觉内容。它更适合轻量、快速、结构化的 Markdown 海报制作流程。
