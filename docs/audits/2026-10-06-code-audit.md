# 项目代码审核（2026-10-06）

本轮检查了全部项目源文件、静态元数据、已有测试和历史稳定性设计，并用 Chromium 验证主要业务流程。项目是纯静态 HTML/CSS/JavaScript 应用，没有服务端接口、数据库服务或身份认证代码。安全验证重点是用户 Markdown、原生 HTML、图表配置和导出文件的输入边界。

## 已完成的修复

| 问题 | 修复 | 验证 |
| --- | --- | --- |
| 手写 HTML 过滤仍保留 `<style>` 和 SVG `animate` 等危险结构 | 使用 DOMPurify 3.4.16，保留合法 Markdown/图表元数据；库不可用时输出转义文本 | 浏览器验证样式注入、SVG 动画、事件属性、危险 URL 及安全降级 |
| 原生 HTML 可向 Prism 自动加载器提供额外依赖路径 | 移除 data-dependencies/data-src/data-jsonp 等加载属性，保留普通语言代码块 | 安全过滤与普通代码高亮回归 |
| 卡片类型直接拼入 HTML 属性，可从原生 HTML 元数据注入新标签 | 卡片类型采用固定白名单 | 恶意类型不能创建图片或事件处理器 |
| 图表配置仍存在原生 HTML/URL 入口 | 清理 tooltip 模板、dataView 文本、危险链接及原型属性 | 配置输入边界回归 |
| Mermaid、KaTeX、ECharts、Prism 使用存在已知漏洞的版本 | 分别更新至 10.9.8、0.18.2、6.1.0、1.30.0 | 全部现有公式/化学式/图表模板可渲染；ECharts 加入官方 v5 兼容主题 |
| 固定 CDN 资源缺少完整性校验，脚本阻塞 HTML 解析 | 静态脚本与样式加入 SHA-384 校验；脚本保持顺序并使用 defer；导出依赖也校验完整性 | 实际加载、静态规则与三种导出均通过 |
| 预览替换 DOM 时旧 ECharts 实例和 ResizeObserver 未释放 | 替换、清空、失败、转换为图片和移除导出节点时主动销毁 | 旧图表 isDisposed 为 true；setOption 失败也能释放 |
| 图表/卡片随机 ID 使相同内容无法命中缓存；异步管线可能重叠 | 在预处理前比较原始内容，串行渲染并合并最新编辑 | 相同内容复用实例；连续输入只保留最新结果 |
| Mermaid ID 来自用户属性，导出可能与预览冲突 | 使用应用生成的独立 ID，不信任输入中的 DOM ID | 图表与导出回归 |
| 非法百分号编码会中断整个渲染流程 | 单独处理每个图表/卡片的解码错误 | 坏块显示错误，后续正文正常显示 |
| 导出可能捕获防抖之前的旧内容；克隆节点失败后遗留资源 | 导出前等待最新预览；成功与失败均清理克隆及图表 | 导出包含最新文字且结束后无克隆节点 |
| 导出图表等待固定 500ms 仍可能捕获未结束的动画 | 导出节点禁用图表动画并等待渲染帧 | 下载的图表为完整最终状态 |
| 重复点击导出可能重复加载库、并行生成大画布 | 合并库加载请求、支持失败重试，导出期间避免重复任务 | 加载/重试测试及真实导出 |
| 网络等待和图片事件监听缺少完整清理 | 脚本、字体、样式、图片代理设置等待上限；移除图片监听 | 代码检查及导出回归 |
| PNG Base64 和透明边缘检查额外占用大块内存 | PNG 使用 Blob 下载；不透明四角直接跳过全图像素复制；跳过超出画布尺寸限制的比例 | PNG 下载与像素读取测试 |
| 启动一次读取所有历史图片、每张图片重复编译替换正则 | 只加载当前草稿引用的图片，保留历史数据库记录；跳过未引用图片并使用文字替换 | 本地图片刷新恢复与三种格式导出 |
| 卡片/图表后紧邻的 Markdown 可能被吞进原生 HTML 块 | 为生成的块明确添加 Markdown 边界；卡片内也解析稳定图片引用 | 图片、正文和卡片回归 |
| HTML 导出缺少 CSP，内联公式样式的字体相对路径失效 | 导出页禁止脚本和表单，字体路径改为源样式表的绝对 URL，拉取样式时校验完整性 | 独立 HTML 显示图表和公式字体，页面没有脚本 |
| 字体请求提前拒绝可能产生未处理异常 | 在 PDF 截图之前等待字体，保留原有位图 PDF 降级 | PDF 下载含嵌入字体、Unicode 映射及 12 个文字对象 |
| 空草稿刷新后被默认内容覆盖、异常设置导致巨大尺寸 | 恢复空字符串草稿；将恢复的数值限制在原有控件范围 | 原生 Node 回归 |
| 比例与导出宽度计入父容器的显示缩放 | 使用 offsetWidth 读取海报与内卡片的布局尺寸，保留文字换行及固定比例 | 25–200% 缩放、480/640/800px 宽度、全部三种模式回归 |
| 上轮清理误删按钮依赖的缩放 class 样式；双指操作与按钮使用不同入口 | 统一使用 applyZoom 设置显示变换；回到 100% 清除变换；双指操作后按钮限制在原范围 | 实际按钮与触摸事件回归，补充按钮边界与双指零距离检查 |
| meta CSP 中的 frame-ancestors 不能阻止第三方嵌入 | 用户确认 Cloudflare 部署后，新增根目录 _headers，设置 frame-ancestors 'self' 与 X-Frame-Options: SAMEORIGIN；移除 meta 中无效的防嵌入指令 | 静态规则检查通过；线上首页、index.html 入口及静态资源确认返回安全响应头 |

## 已经用户同意的无障碍与维护整理

- 设置面板补齐 dialog 语义、隐藏状态、背景 inert、初始焦点、Tab 循环和关闭后焦点恢复。
- 背景预设支持 Enter/Space，控件提供可访问名称，模式/菜单公开展开或选中状态，通知提供朗读语义。
- 增加仅键盘操作时可见的焦点边框。
- 修正移动菜单缺少定位父节点导致出现在屏幕下方的问题，限制菜单高度并允许滚动。
- 输入后立即撤销也保存尚未进入防抖历史的内容；其他输入框和弹窗保持自己的撤销操作。
- 移除未使用的 StateManager、ImageCache、代理/图片属性助手、重复预览防抖与旧固定高度状态。缩放 class 样式清理导致的按钮回归已在后续修复中纠正，按钮和双指缩放统一使用内联变换。保留现有全局应用 API 和静态部署方式。
- 桌面默认页面前后截图一致，控件、配色、内容布局及导出格式保持原有设计。

## 验证结果

- `node --check script.js`、静态与逻辑两组 Node 测试、`git diff --check` 均通过。
- 可复用浏览器回归位于 `tests/browser-regression.mjs`：安全过滤、全部现有模板、异步管线、实例释放、最新内容导出、焦点管理、键盘背景预设、固定比例、390px 移动菜单。
- 本地图片经 IndexedDB 保存、页面刷新后恢复，PNG、HTML、PDF 真实下载通过。
- PNG 宽度为 1280px（640px 海报 × 2）；HTML 可独立打开，公式字体加载成功且图表为图片；PDF 保留中文字对象和 Unicode 映射。
- 后续缩放修复验证：25–200% × 480/640/800px × 自由/小红书/朋友圈，共 72 组布局与导出节点检查通过；按钮和触摸事件检查通过；150% 下实际下载 PNG、HTML、PDF，PNG 仍为 1280px，PDF 仍含嵌入字体和 Unicode 映射。
- Cloudflare 配置提交 fd974bc 发布后，线上 `/`、`/index.html`（重定向至 `/`）及带新查询参数的 `script.js` 均确认返回 `Content-Security-Policy: frame-ancestors 'self';` 和 `X-Frame-Options: SAMEORIGIN`；首页无效的 meta 防嵌入指令已移除。初次请求处于发布切换期间，后续复查确认所有检查入口都已更新。
- 没有新增运行时包管理、构建步骤或 Python 环境。

## 尚需后续处理

1. **超大/恶意输入的计算隔离。** 已修补当前依赖公告中的卡死问题，并减少重复任务；没有引入 Worker 隔离或统一内容长度限制。极大的 Markdown、数学公式、复杂图表或自定义数据转换正则仍可能让浏览器繁忙。限制输入或隔离计算会影响产品使用范围，宜作为后续独立设计。
2. **历史图片生命周期。** 本轮减少内存加载，不自动删除历史数据库记录，避免影响图片找回。若需长期存储治理，应增加清理/恢复机制并明确保留策略。

Cloudflare 防嵌入配置必须随静态资源部署；Pages 与 Workers Static Assets 都支持 `_headers`。若页面改由 Functions 或 Worker 代码生成，须在其 Response 中显式设置。提交配置不等于线上已经生效，以部署后的 HTTP 响应头为准。

审核和验证不能证明所有输入及所有浏览器均不存在漏洞。跨域图片仍依赖原站 CORS 和现有公共代理服务，离线导出的远程图片和公式字体也仍需要网络。

## 官方依据

- [Mermaid CSS 注入](https://github.com/mermaid-js/mermaid/security/advisories/GHSA-6x64-9x62-f2gx)、[XY Chart 死循环](https://github.com/mermaid-js/mermaid/security/advisories/GHSA-2v8p-3f2j-5mp7)：v10 修复版本 10.9.8。
- [KaTeX trust 限制绕过](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7)：修复版本 0.18.2；[宏展开限制绕过](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-64fm-8hw2-v72w)。
- [ECharts Lines tooltip XSS](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx)：修复版本 6.1.0；[官方安全输入指南](https://echarts.apache.org/handbook/en/best-practices/security/)。
- [ECharts 6 升级兼容指南](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/)：使用官方 v5 主题保留旧配色及默认布局。
- [Prism DOM clobbering](https://github.com/advisories/GHSA-x7hr-w5r2-h6wg)：修复版本 1.30.0。
- [DOMPurify 官方项目与配置说明](https://github.com/cure53/DOMPurify)。
- [Cloudflare Pages 响应头配置](https://developers.cloudflare.com/pages/configuration/headers/)、[Workers Static Assets 响应头配置](https://developers.cloudflare.com/workers/static-assets/headers/)。
