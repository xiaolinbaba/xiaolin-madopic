// 全局变量
let currentZoom = 100;
let currentBackground = 'gradient1';

// ===== 数学公式渲染器 =====
class MathRenderer {
    constructor() {
        this.isKaTeXLoaded = false;
        this.checkKaTeXAvailability();
    }

    checkKaTeXAvailability() {
        this.isKaTeXLoaded = typeof katex !== 'undefined' && typeof renderMathInElement !== 'undefined';
        if (!this.isKaTeXLoaded) {
            console.warn('KaTeX not loaded. Math formulas will not be rendered.');
        } else {
            // 检查mhchem扩展是否可用
            const hasMhchem = typeof katex.__defineMacro !== 'undefined' || 
                              (window.katex && window.katex.__plugins && window.katex.__plugins['mhchem']);
            if (hasMhchem) {
                console.log('KaTeX with mhchem extension loaded successfully');
            } else {
                console.warn('KaTeX loaded but mhchem extension may not be available');
            }
        }
    }

    renderMath(element) {
        if (!this.isKaTeXLoaded) {
            console.warn('KaTeX not available for math rendering');
            return;
        }

        try {
            renderMathInElement(element, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\[', right: '\\]', display: true},
                    {left: '\\(', right: '\\)', display: false}
                ],
                throwOnError: false,
                errorColor: '#cc0000',
                strict: false,
                trust: true,
                macros: {
                    // 物理常量
                    '\\emc': 'E=mc^{2}',
                    '\\hbar': '\\hslash',
                    '\\kb': 'k_B',
                    '\\NA': 'N_A',
                    // 常用符号
                    '\\R': '\\mathbb{R}',
                    '\\C': '\\mathbb{C}',
                    '\\N': '\\mathbb{N}',
                    '\\Z': '\\mathbb{Z}',
                    '\\Q': '\\mathbb{Q}',
                    // 微积分
                    '\\dd': '\\mathrm{d}',
                    '\\dv': ['\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}', 2],
                    '\\pdv': ['\\frac{\\partial#1}{\\partial#2}', 2],
                    // 向量
                    '\\vb': ['\\mathbf{#1}', 1],
                    '\\vu': ['\\hat{\\mathbf{#1}}', 1],
                    // 物理单位
                    '\\unit': ['\\,\\mathrm{#1}', 1]
                },
                fleqn: false,
                displayMode: false
            });
        } catch (error) {
            console.error('Math rendering error:', error);
            this.showMathError(element, error.message);
        }
    }

    showMathError(element, errorMessage) {
        const errorElements = element.querySelectorAll('.katex-error');
        errorElements.forEach(errorEl => {
            errorEl.style.color = '#cc0000';
            errorEl.title = `Math Error: ${errorMessage}`;
        });
    }

    // 预处理Markdown中的数学公式
    preprocessMath(markdown) {
        // 处理质能守恒公式的特殊情况
        markdown = markdown.replace(/E\s*=\s*mc\^?2/g, '$E=mc^{2}$');
        
        // 处理其他常见物理公式
        markdown = markdown.replace(/F\s*=\s*ma/g, '$F=ma$');
        markdown = markdown.replace(/v\s*=\s*u\s*\+\s*at/g, '$v=u+at$');
        markdown = markdown.replace(/s\s*=\s*ut\s*\+\s*½at²/g, '$s=ut+\\frac{1}{2}at^{2}$');
        markdown = markdown.replace(/v²\s*=\s*u²\s*\+\s*2as/g, '$v^{2}=u^{2}+2as$');
        
        // 处理数学常量
        markdown = markdown.replace(/π/g, '$\\pi$');
        markdown = markdown.replace(/∞/g, '$\\infty$');
        markdown = markdown.replace(/±/g, '$\\pm$');
        markdown = markdown.replace(/≤/g, '$\\leq$');
        markdown = markdown.replace(/≥/g, '$\\geq$');
        markdown = markdown.replace(/≠/g, '$\\neq$');
        markdown = markdown.replace(/∈/g, '$\\in$');
        markdown = markdown.replace(/∉/g, '$\\notin$');
        markdown = markdown.replace(/⊆/g, '$\\subseteq$');
        markdown = markdown.replace(/⊇/g, '$\\supseteq$');
        markdown = markdown.replace(/∪/g, '$\\cup$');
        markdown = markdown.replace(/∩/g, '$\\cap$');
        markdown = markdown.replace(/∅/g, '$\\emptyset$');
        
        // 处理希腊字母
        markdown = markdown.replace(/α/g, '$\\alpha$');
        markdown = markdown.replace(/β/g, '$\\beta$');
        markdown = markdown.replace(/γ/g, '$\\gamma$');
        markdown = markdown.replace(/δ/g, '$\\delta$');
        markdown = markdown.replace(/ε/g, '$\\epsilon$');
        markdown = markdown.replace(/θ/g, '$\\theta$');
        markdown = markdown.replace(/λ/g, '$\\lambda$');
        markdown = markdown.replace(/μ/g, '$\\mu$');
        markdown = markdown.replace(/σ/g, '$\\sigma$');
        markdown = markdown.replace(/φ/g, '$\\phi$');
        markdown = markdown.replace(/ω/g, '$\\omega$');
        
        return markdown;
    }
}

// 创建全局数学渲染器实例
const mathRenderer = new MathRenderer();

// ===== 图表渲染器 =====
class DiagramRenderer {
    constructor() {
        this.isMermaidLoaded = false;
        this.mermaidConfig = {
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
                primaryColor: '#6366f1',
                primaryTextColor: '#1f2937',
                primaryBorderColor: '#4f46e5',
                lineColor: '#6b7280',
                secondaryColor: '#f3f4f6',
                tertiaryColor: '#ffffff'
            },
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            },
            sequence: {
                useMaxWidth: true,
                wrap: true
            },
            gantt: {
                useMaxWidth: true
            }
        };
        this.checkMermaidAvailability();
    }

    checkMermaidAvailability() {
        this.isMermaidLoaded = typeof mermaid !== 'undefined';
        if (this.isMermaidLoaded) {
            try {
                mermaid.initialize(this.mermaidConfig);
                console.log('Mermaid initialized successfully');
            } catch (error) {
                console.error('Mermaid initialization error:', error);
                this.isMermaidLoaded = false;
            }
        } else {
            console.warn('Mermaid not loaded. Diagrams will not be rendered.');
        }
    }

    async renderDiagram(element, diagramCode, diagramId) {
        if (!this.isMermaidLoaded) {
            console.warn('Mermaid not available for diagram rendering');
            this.showDiagramError(element, 'Mermaid library not loaded');
            return;
        }

        try {
            // 清除之前的内容
            element.innerHTML = '';
            
            // 渲染图表
            const { svg } = await mermaid.render(diagramId, diagramCode);
            element.innerHTML = svg;
            
            // 添加图表容器样式
            element.classList.add('mermaid-diagram');
            
        } catch (error) {
            console.error('Diagram rendering error:', error);
            this.showDiagramError(element, error.message);
        }
    }

    showDiagramError(element, errorMessage) {
        element.innerHTML = `
            <div class="diagram-error">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="error-title">图表渲染错误</div>
                <div class="error-message">${errorMessage}</div>
            </div>
        `;
        element.classList.add('diagram-error-container');
    }

    // 预处理Markdown中的图表代码
    preprocessDiagram(markdown) {
        // 为每个mermaid代码块生成唯一ID
        let diagramCounter = 0;
        return markdown.replace(/```mermaid\s*\n([\s\S]*?)\n```/g, (match, code) => {
            const diagramId = `mermaid-diagram-${++diagramCounter}`;
            return `<div class="mermaid-container" data-diagram-id="${diagramId}" data-diagram-code="${encodeURIComponent(code.trim())}"></div>`;
        });
    }

    // 渲染页面中的所有图表
    async renderDiagrams(container) {
        if (!this.isMermaidLoaded) {
            return;
        }

        const diagramContainers = container.querySelectorAll('.mermaid-container');
        
        for (const diagramContainer of diagramContainers) {
            const diagramId = diagramContainer.getAttribute('data-diagram-id');
            const diagramCode = decodeURIComponent(diagramContainer.getAttribute('data-diagram-code'));
            
            if (diagramId && diagramCode) {
                await this.renderDiagram(diagramContainer, diagramCode, diagramId);
            }
        }
    }

    // 设置主题
    setTheme(theme) {
        if (!this.isMermaidLoaded) {
            return;
        }

        this.mermaidConfig.theme = theme;
        try {
            mermaid.initialize(this.mermaidConfig);
        } catch (error) {
            console.error('Theme update error:', error);
        }
    }
}

// 创建全局图表渲染器实例
const diagramRenderer = new DiagramRenderer();

// ECharts 渲染器类
class EChartsRenderer {
    constructor() {
        this.isEChartsLoaded = false;
        this.checkEChartsAvailability();
    }

    checkEChartsAvailability() {
        this.isEChartsLoaded = typeof echarts !== 'undefined';
        if (!this.isEChartsLoaded) {
            console.warn('ECharts not loaded. ECharts diagrams will not be rendered.');
        }
    }

    async renderEChart(element, chartConfig, chartId) {
        if (!this.isEChartsLoaded) {
            console.warn('ECharts not available for chart rendering');
            this.showEChartError(element, 'ECharts library not loaded');
            return;
        }

        try {
            // 清除之前的内容
            element.innerHTML = '';
            
            // 创建图表容器
            const chartContainer = document.createElement('div');
            chartContainer.id = chartId;
            chartContainer.style.width = '100%';
            chartContainer.style.height = '400px';
            chartContainer.style.minHeight = '300px';
            element.appendChild(chartContainer);

            // 解析配置
            let config;
            if (typeof chartConfig === 'string') {
                config = JSON.parse(chartConfig);
            } else {
                config = chartConfig;
            }

            // 初始化图表
            const chart = echarts.init(chartContainer);
            chart.setOption(config);

            // 响应式调整
            const resizeObserver = new ResizeObserver(() => {
                chart.resize();
            });
            resizeObserver.observe(chartContainer);

            // 存储图表实例以便后续操作
            chartContainer._echartsInstance = chart;
            chartContainer._resizeObserver = resizeObserver;

        } catch (error) {
            console.error('ECharts rendering error:', error);
            this.showEChartError(element, error.message);
        }
    }

    showEChartError(element, errorMessage) {
        element.innerHTML = `
            <div class="echarts-error" style="
                padding: 20px;
                border: 2px dashed #ff6b6b;
                border-radius: 8px;
                background-color: #ffe0e0;
                color: #d63031;
                text-align: center;
                font-family: monospace;
            ">
                <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                ECharts Error: ${errorMessage}
            </div>
        `;
    }

    preprocessECharts(markdown) {
        // 处理 ```echarts 代码块
        return markdown.replace(/```echarts\s*\n([\s\S]*?)\n```/g, (match, code) => {
            const chartId = 'echarts-' + Math.random().toString(36).substr(2, 9);
            return `<div class="echarts-container" data-echarts-id="${chartId}" data-echarts-config="${encodeURIComponent(code.trim())}"></div>`;
        });
    }

    async renderECharts(container) {
        const echartsElements = container.querySelectorAll('.echarts-container');
        
        for (const element of echartsElements) {
            const chartId = element.getAttribute('data-echarts-id');
            const configData = decodeURIComponent(element.getAttribute('data-echarts-config'));
            
            await this.renderEChart(element, configData, chartId);
        }
    }
}

// 创建全局 ECharts 渲染器实例
const echartsRenderer = new EChartsRenderer();

// ===== 卡片渲染器 =====
class CardRenderer {
    constructor() {
        // 卡片渲染器不需要外部依赖
    }

    // 预处理Markdown中的卡片语法
    preprocessCards(markdown) {
        // 处理 :::card 语法，支持不同类型的卡片
        return markdown.replace(/:::card(?:\s+(info|success|warning|error))?\s*\n([\s\S]*?)\n:::/g, (match, type, content) => {
            const cardType = type || 'default';
            const cardId = 'card-' + Math.random().toString(36).substr(2, 9);
            return `<div class="card-container" data-card-id="${cardId}" data-card-type="${cardType}" data-card-content="${encodeURIComponent(content.trim())}"></div>`;
        });
    }

    // 渲染页面中的所有卡片
    async renderCards(container) {
        const cardContainers = container.querySelectorAll('.card-container');
        
        for (const cardContainer of cardContainers) {
            const cardId = cardContainer.getAttribute('data-card-id');
            const cardType = cardContainer.getAttribute('data-card-type');
            const cardContent = decodeURIComponent(cardContainer.getAttribute('data-card-content'));
            
            if (cardId && cardContent) {
                await this.renderCard(cardContainer, cardContent, cardType);
            }
        }
    }

    // 渲染单个卡片
    async renderCard(element, content, type) {
        try {
            // 清除之前的内容
            element.innerHTML = '';
            
            // 解析卡片内容的Markdown
            let htmlContent = '';
            try {
                htmlContent = marked.parse(content);
            } catch (err) {
                console.error('卡片内容Markdown解析失败: ', err);
                htmlContent = '<p>卡片内容解析失败</p>';
            }
            
            // 创建卡片HTML结构
            const cardHtml = `
                <div class="madopic-card ${type !== 'default' ? 'card-' + type : ''}">
                    <div class="card-content">
                        ${htmlContent}
                    </div>
                </div>
            `;
            
            element.innerHTML = cardHtml;
            
        } catch (error) {
            console.error('卡片渲染错误:', error);
            element.innerHTML = `
                <div class="madopic-card">
                    <div class="card-content">
                        <p style="color: #ef4444;">卡片渲染失败：${error.message}</p>
                    </div>
                </div>
            `;
        }
    }
}

// 创建全局卡片渲染器实例
const cardRenderer = new CardRenderer();

// ===== 导出相关常量 =====
// 控制导出清晰度的缩放倍数范围
const EXPORT_MIN_SCALE = 2;
const EXPORT_MAX_SCALE = 3;

function getPreferredExportScale() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlScale = parseFloat(urlParams.get('scale'));
        const storedScale = parseFloat(localStorage.getItem('madopic_export_scale'));
        const base = Number.isFinite(urlScale)
            ? urlScale
            : (Number.isFinite(storedScale)
                ? storedScale
                : Math.max(2, window.devicePixelRatio || 1));
        return Math.min(EXPORT_MAX_SCALE, Math.max(EXPORT_MIN_SCALE, base));
    } catch (_) {
        return Math.max(EXPORT_MIN_SCALE, Math.min(EXPORT_MAX_SCALE, 2));
    }
}

const EXPORT_SCALE = getPreferredExportScale();

// 预设背景渐变
const backgroundPresets = {
    gradient1: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    gradient2: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    gradient3: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    gradient4: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    gradient5: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    gradient6: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    gradient7: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    gradient8: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
};

// DOM 元素
const markdownInput = document.getElementById('markdownInput');
const lineNumbersEl = document.querySelector('.line-numbers');
const posterContent = document.getElementById('posterContent');
const markdownPoster = document.getElementById('markdownPoster');
const previewContent = document.getElementById('previewContent');
const backgroundPanel = document.getElementById('backgroundPanel');
const layoutPanel = document.getElementById('layoutPanel');
const overlay = document.getElementById('overlay');
const zoomLevel = document.querySelector('.zoom-level');

// 新增设置变量
let currentFontSize = 18;
let currentPadding = 40;
let currentWidth = 640;
let currentMode = 'free'; // 'free' | 'xhs' | 'pyq'
let fixedHeights = { xhs: null, pyq: null }; // 等待用户提供后设置

// 图片数据存储
const imageDataStore = new Map();

// 预览渲染状态
let hasInitialPreviewRendered = false;
let lastRenderedMarkdown = '';

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    updatePreview();
});

// 初始化应用
function initializeApp() {
    // 配置 marked 选项
    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
        highlight: function(code, lang) {
            return code;
        }
    });
    
    // 设置初始背景
    applyBackground(backgroundPresets[currentBackground]);
    
    // 应用初始设置
    applyFontSize(currentFontSize);
    applyPadding(currentPadding);
    applyWidth(currentWidth);
    
    // 初始化图表渲染器主题
    diagramRenderer.setTheme('default');
    
    // 更新缩放显示
    updateZoomDisplay();

    // 初始化行号
    updateLineNumbers();
}

// 设置事件监听器
function setupEventListeners() {
    // Markdown 输入监听
    // 更平滑的输入预览：稍延长防抖并在输入结束时仅渲染一次
    markdownInput.addEventListener('input', debounce(updatePreview, 250));
    markdownInput.addEventListener('input', updateLineNumbers);
    markdownInput.addEventListener('scroll', syncLineNumbersScroll);
    
    // 工具栏按钮
    setupToolbarButtons();
    
    // 缩放控制
    document.getElementById('zoomIn').addEventListener('click', zoomIn);
    document.getElementById('zoomOut').addEventListener('click', zoomOut);
    
    // 背景设置面板
    document.getElementById('backgroundBtn').addEventListener('click', openBackgroundPanel);
    document.getElementById('cancelBackground').addEventListener('click', closeBackgroundPanel);
    document.getElementById('applyBackground').addEventListener('click', applyBackgroundSettings);
    
    // 文字布局设置面板
    document.getElementById('layoutBtn').addEventListener('click', openLayoutPanel);
    document.getElementById('cancelLayout').addEventListener('click', closeLayoutPanel);
    document.getElementById('applyLayout').addEventListener('click', applyLayoutSettings);
    
    overlay.addEventListener('click', closeAllPanels);

    // 滑块事件监听
    setupSliders();
    
    // 导出功能
    setupExportButtons();
    setupModeButtons();
    
    // 背景预设选择
    setupBackgroundPresets();
    
    // 自定义颜色输入
    setupColorInputs();
    
    // 图片处理
    setupImageHandlers();
    
    // 键盘快捷键
    setupKeyboardShortcuts();
}

// 设置导出按钮事件
function setupExportButtons() {
    const exportPngBtn = document.getElementById('exportPngBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const exportHtmlBtn = document.getElementById('exportHtmlBtn');

    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', exportToPNG);
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportToPDF);
    }

    if (exportHtmlBtn) {
        exportHtmlBtn.addEventListener('click', exportToHTML);
    }
}

// 模式按钮绑定
function setupModeButtons() {
    const group = document.getElementById('modeGroup');
    if (!group) return;
    group.querySelectorAll('button[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            setMode(mode);
        });
    });
}

function setMode(mode) {
    if (!['free', 'xhs', 'pyq'].includes(mode)) return;
    currentMode = mode;
    // 切换按钮激活态
    const group = document.getElementById('modeGroup');
    if (group) {
        group.querySelectorAll('button[data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
        });
    }
    // 预览区域视觉反馈（仅预览容器外层，不改导出逻辑）
    applyPreviewModeFrame();
    // 切换模式后重新渲染预览以应用分页或高度变化
    updatePreview();
}

function applyPreviewModeFrame() {
    // 预览时根据模式设置固定可视高度（以外层 markdownPoster 的 box 包含 padding 与内容）
    markdownPoster.dataset.mode = currentMode;
    if (currentMode === 'xhs') {
        // 小红书模式：宽度固定，允许高度自适应；分页逻辑单独处理，不在此裁剪
        markdownPoster.style.height = '';
        markdownPoster.style.minHeight = '';
        markdownPoster.style.overflow = 'visible';
        posterContent.style.maxHeight = '';
        posterContent.style.overflow = 'visible';
    } else if (currentMode === 'pyq') {
        // 朋友圈固定比例：1290x2796 ≈ 宽:高 = 1290:2796。
        // 在保持当前外层宽度不变的前提下，按该比例计算高度。
        const rect = markdownPoster.getBoundingClientRect();
        const targetHeight = Math.round(rect.width * (2796 / 1290));
        markdownPoster.style.height = `${targetHeight}px`;
        markdownPoster.style.minHeight = `${targetHeight}px`;
        markdownPoster.style.overflow = 'hidden';

        const mpComputed = getComputedStyle(markdownPoster);
        const paddingTop = parseFloat(mpComputed.paddingTop) || 0;
        const paddingBottom = parseFloat(mpComputed.paddingBottom) || 0;
        const innerMax = Math.max(0, targetHeight - paddingTop - paddingBottom);
        posterContent.style.maxHeight = `${innerMax}px`;
        posterContent.style.overflow = 'hidden';
    } else {
        markdownPoster.style.height = '';
        markdownPoster.style.minHeight = '600px';
        markdownPoster.style.overflow = 'visible';
        posterContent.style.maxHeight = '';
        posterContent.style.overflow = 'visible';
    }
}

// 设置工具栏按钮
function setupToolbarButtons() {
    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            handleToolbarAction(action);
        });
    });
}

// 处理工具栏动作
function handleToolbarAction(action) {
    const textarea = markdownInput;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);
    
    let insertText = '';
    let cursorPos = start;
    
    switch(action) {
        case 'bold':
            insertText = `**${selectedText || '粗体文本'}**`;
            cursorPos = start + (selectedText ? insertText.length : 2);
            break;
        case 'italic':
            insertText = `*${selectedText || '斜体文本'}*`;
            cursorPos = start + (selectedText ? insertText.length : 1);
            break;
        case 'heading':
            insertText = `## ${selectedText || '标题'}`;
            cursorPos = start + (selectedText ? insertText.length : 3);
            break;
        case 'list':
            insertText = `\n- ${selectedText || '列表项'}`;
            cursorPos = start + (selectedText ? insertText.length : 3);
            break;
        case 'link':
            insertText = `[${selectedText || '链接文本'}](https://example.com)`;
            cursorPos = start + (selectedText ? insertText.length : 1);
            break;
        case 'image':
            insertImage();
            return;
        case 'flowchart':
            MarkdownHelper.insertFlowchart();
            return;
        case 'sequence':
            MarkdownHelper.insertSequenceDiagram();
            return;
        case 'gantt':
            MarkdownHelper.insertGanttChart();
            return;
        case 'pie':
            MarkdownHelper.insertPieChart();
            return;
        case 'math':
            MarkdownHelper.insertMathFormulas();
            return;
        case 'physics':
            MarkdownHelper.insertPhysicsFormulas();
            return;
        case 'chemistry':
            MarkdownHelper.insertChemistryFormulas();
            return;
        case 'echarts':
            MarkdownHelper.insertEChartsTemplate();
            return;
        case 'einstein':
            MarkdownHelper.insertEinsteinFormula();
            return;
        case 'card':
            MarkdownHelper.insertCard();
            return;
        case 'empty-line':
            // 插入可在预览中可见的"Markdown 空行"占位段落
            insertText = `\n\n<p class="md-empty-line">&nbsp;</p>\n\n`;
            cursorPos = start + insertText.length;
            break;
        case 'clear':
            textarea.value = '';
            updatePreview();
            textarea.focus();
            return;
    }
    
    textarea.value = beforeText + insertText + afterText;
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.focus();
    updatePreview();
}

// 更新预览
async function updatePreview() {
    const markdownText = markdownInput.value.trim();
    // 同步行号（在去抖预览之外也保证立即更新）
    updateLineNumbers();
    
    // 检查是否为空内容
    if (!markdownText) {
        showEmptyPreview();
        return;
    }
    
    // 预处理数学公式
    let processedMarkdown = mathRenderer.preprocessMath(markdownText);
    
    // 预处理图表
    processedMarkdown = diagramRenderer.preprocessDiagram(processedMarkdown);
    
    // 预处理 ECharts 图表
    processedMarkdown = echartsRenderer.preprocessECharts(processedMarkdown);
    
    // 预处理卡片
    processedMarkdown = cardRenderer.preprocessCards(processedMarkdown);
    
    // 替换简化的base64为完整版本进行预览
    processedMarkdown = replaceImageDataForPreview(processedMarkdown);
    
    // 仅在已完成至少一次渲染后，且内容确实未变化时跳过
    if (hasInitialPreviewRendered && processedMarkdown === lastRenderedMarkdown) {
        return;
    }
    lastRenderedMarkdown = processedMarkdown;

    let htmlContent = '';
    try {
        htmlContent = marked.parse(processedMarkdown);
    } catch (err) {
        console.error('Markdown 渲染失败: ', err);
        htmlContent = '<p style="color:#ef4444">渲染失败，请检查 Markdown 内容。</p>';
    }
    posterContent.innerHTML = htmlContent;
    
    // 渲染数学公式
    mathRenderer.renderMath(posterContent);
    
    // 渲染图表
    await diagramRenderer.renderDiagrams(posterContent);
    
    // 渲染 ECharts 图表
    await echartsRenderer.renderECharts(posterContent);
    
    // 渲染卡片
    await cardRenderer.renderCards(posterContent);

    // 小红书模式分页（宽度固定，高度自适应，不截断块）
    if (currentMode === 'xhs') {
        paginateContentForXhs();
    } else {
        clearXhsPaginationArtifacts();
    }
    
    // 确保内容容器可见
    posterContent.style.display = 'block';
    
    // 重新应用当前的字体大小设置
    applyFontSize(currentFontSize);
    
    // 仅首次渲染使用淡入动画，后续输入不再触发，避免屏闪
    if (!hasInitialPreviewRendered) {
        posterContent.style.animation = 'fadeIn 0.3s ease';
        hasInitialPreviewRendered = true;
    } else {
        posterContent.style.animation = '';
    }
}

// ===== 小红书分页逻辑（宽度固定，高度自适应，不截断块） =====
function getXhsTargetHeight() {
    try {
        const rect = markdownPoster.getBoundingClientRect();
        const width = rect && rect.width ? rect.width : (currentWidth || 640);
        return Math.round((width / 3) * 4);
    } catch (_) {
        return Math.round(((currentWidth || 640) / 3) * 4);
    }
}

function createXhsPage() {
    const page = document.createElement('div');
    page.className = 'xhs-page';
    return page;
}

function createPageSplitLine() {
    const line = document.createElement('div');
    line.className = 'page-split-line';
    return line;
}

function addPageIndicator(page, index, total) {
    if (!page) return;
    const indicator = document.createElement('div');
    indicator.className = 'page-number-indicator';
    indicator.textContent = `第 ${index}/${total} 页`;
    page.appendChild(indicator);
}

function clearXhsPaginationArtifacts() {
    if (!posterContent) return;
    const pages = posterContent.querySelectorAll('.xhs-page');
    if (!pages.length) return;

    const fragment = document.createDocumentFragment();
    pages.forEach(page => {
        // 移除页码
        const indicator = page.querySelector('.page-number-indicator');
        if (indicator) indicator.remove();
        // 把内容搬回主容器
        while (page.firstChild) {
            fragment.appendChild(page.firstChild);
        }
    });

    // 移除分隔线
    posterContent.querySelectorAll('.page-split-line').forEach(line => line.remove());

    // 重置容器
    posterContent.innerHTML = '';
    posterContent.appendChild(fragment);
}

function paginateContentForXhs() {
    if (!posterContent) return;

    // 收集当前渲染后的块级元素
    const blocks = Array.from(posterContent.children).filter(node => node.nodeType === 1);
    if (!blocks.length) return;

    const targetHeight = getXhsTargetHeight();
    const maxFlexibleHeight = Math.round(targetHeight * 1.3);

    // 用临时容器测量高度，避免影响最终 DOM
    const tempWrapper = document.createElement('div');
    tempWrapper.style.position = 'absolute';
    tempWrapper.style.visibility = 'hidden';
    tempWrapper.style.pointerEvents = 'none';
    tempWrapper.style.width = '100%';

    // 清空主容器并放入临时测量容器
    posterContent.innerHTML = '';
    posterContent.appendChild(tempWrapper);

    const pages = [];
    let currentPage = createXhsPage();

    for (const block of blocks) {
        currentPage.appendChild(block);
        tempWrapper.appendChild(currentPage);

        const pageHeight = currentPage.scrollHeight;
        const withinFlexible = pageHeight <= maxFlexibleHeight;

        if (!withinFlexible) {
            const singleBlock = currentPage.childElementCount === 1;

            if (!singleBlock) {
                // 回退该块，结束当前页，开启新页
                currentPage.removeChild(block);
                pages.push(currentPage);

                currentPage = createXhsPage();
                currentPage.appendChild(block);
                tempWrapper.appendChild(currentPage);
            } else {
                // 单块过高，允许该页超高
                pages.push(currentPage);
                currentPage = createXhsPage();
            }
        }
    }

    if (currentPage && currentPage.childElementCount) {
        pages.push(currentPage);
    }

    // 把页内容写回预览容器并添加分隔/页码
    posterContent.innerHTML = '';
    pages.forEach((page, idx) => {
        addPageIndicator(page, idx + 1, pages.length);
        posterContent.appendChild(page);
        if (idx < pages.length - 1) {
            posterContent.appendChild(createPageSplitLine());
        }
    });

    // 移除临时测量容器
    tempWrapper.remove();
}

// ===== 行号逻辑 =====
function updateLineNumbers() {
    if (!lineNumbersEl) return;
    const value = markdownInput.value || '';
    const lines = value.split('\n').length;
    // 构造包含行号的内容（使用换行分隔）
    let content = '';
    for (let i = 1; i <= lines; i++) {
        content += (i === 1 ? '' : '\n') + i;
    }
    lineNumbersEl.textContent = content || '1';
    // 高度同步
    lineNumbersEl.style.height = markdownInput.scrollHeight + 'px';
    syncLineNumbersScroll();
}

function syncLineNumbersScroll() {
    if (!lineNumbersEl) return;
    lineNumbersEl.scrollTop = markdownInput.scrollTop;
}

// 显示空内容提示
function showEmptyPreview() {
    posterContent.innerHTML = `
        <div class="empty-preview">
            <div class="empty-icon">
                <i class="fab fa-markdown"></i>
            </div>
            <h3>开始创作吧！</h3>
            <p>在左侧编辑器中输入 Markdown 内容</p>
            <div class="empty-tips">
                <div class="tip-item">
                    <i class="fas fa-lightbulb"></i>
                    <span>支持标题、列表、链接、图片等格式</span>
                </div>
                <div class="tip-item">
                    <i class="fas fa-keyboard"></i>
                    <span>使用工具栏快捷按钮快速插入格式</span>
                </div>
                <div class="tip-item">
                    <i class="fas fa-palette"></i>
                    <span>点击"自定义"按钮调整背景和样式</span>
                </div>
            </div>
        </div>
    `;
    hasInitialPreviewRendered = false;
}

// 为图片元素设置跨域与防盗链相关属性
function applyImageAttributes(root) {
    const imgs = root.querySelectorAll('img');
    imgs.forEach((img) => {
        try {
            if (!img.getAttribute('crossorigin')) {
                img.setAttribute('crossorigin', 'anonymous');
            }
            if (!img.getAttribute('referrerpolicy')) {
                img.setAttribute('referrerpolicy', 'no-referrer');
            }
            if (!img.getAttribute('decoding')) {
                img.setAttribute('decoding', 'sync');
            }
            if (!img.getAttribute('loading')) {
                img.setAttribute('loading', 'eager');
            }
        } catch (_) {
            // 忽略单个图片设置失败
        }
    });
}

// 缩放控制
function zoomIn() {
    if (currentZoom < 150) {
        currentZoom += 25;
        applyZoom();
    }
}

function zoomOut() {
    if (currentZoom > 50) {
        currentZoom -= 25;
        applyZoom();
    }
}

function applyZoom() {
    previewContent.className = 'preview-content';
    if (currentZoom !== 100) {
        previewContent.classList.add(`zoom-${currentZoom}`);
    }
    updateZoomDisplay();
}

function updateZoomDisplay() {
    zoomLevel.textContent = `${currentZoom}%`;
}

// 背景设置面板
function openBackgroundPanel() {
    backgroundPanel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBackgroundPanel() {
    backgroundPanel.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// 文字布局设置面板
function openLayoutPanel() {
    layoutPanel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLayoutPanel() {
    layoutPanel.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// 关闭所有面板
function closeAllPanels() {
    backgroundPanel.classList.remove('active');
    layoutPanel.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function setupBackgroundPresets() {
    document.querySelectorAll('.bg-preset').forEach(preset => {
        preset.addEventListener('click', function() {
            // 移除其他选中状态
            document.querySelectorAll('.bg-preset').forEach(p => p.classList.remove('active'));
            // 添加选中状态
            this.classList.add('active');
            currentBackground = this.getAttribute('data-bg');
        });
    });
}

function setupColorInputs() {
    const colorStart = document.getElementById('colorStart');
    const colorEnd = document.getElementById('colorEnd');
    const gradientDirection = document.getElementById('gradientDirection');
    
    [colorStart, colorEnd, gradientDirection].forEach(input => {
        input.addEventListener('change', function() {
            // 取消预设选择
            document.querySelectorAll('.bg-preset').forEach(p => p.classList.remove('active'));
            currentBackground = 'custom';
        });
    });
}

function applyBackgroundSettings() {
    // 应用背景设置
    let backgroundCSS;
    if (currentBackground === 'custom') {
        const colorStart = document.getElementById('colorStart').value;
        const colorEnd = document.getElementById('colorEnd').value;
        const direction = document.getElementById('gradientDirection').value;
        backgroundCSS = `linear-gradient(${direction}, ${colorStart} 0%, ${colorEnd} 100%)`;
    } else {
        backgroundCSS = backgroundPresets[currentBackground];
    }
    applyBackground(backgroundCSS);
    
    closeBackgroundPanel();
    
    // 显示成功提示
    showNotification('背景设置已更新！', 'success');
}

function applyLayoutSettings() {
    // 应用字体大小设置
    currentFontSize = parseFloat(document.getElementById('fontSizeSlider').value);
    applyFontSize(currentFontSize);
    
    // 应用边距设置
    currentPadding = parseFloat(document.getElementById('paddingSlider').value);
    applyPadding(currentPadding);
    
    // 应用宽度设置
    currentWidth = parseInt(document.getElementById('widthSlider').value);
    applyWidth(currentWidth);
    
    closeLayoutPanel();
    
    // 显示成功提示
    showNotification('文字布局设置已更新！', 'success');
}

function applyBackground(backgroundCSS) {
    markdownPoster.style.background = backgroundCSS;
}

function applyFontSize(fontSize) {
    // 使用CSS变量统一管理字体大小，避免大量DOM操作
    posterContent.style.setProperty('--dynamic-font-size', `${fontSize}px`);
    posterContent.style.setProperty('--dynamic-h1-size', `${Math.round(fontSize * 1.75)}px`);
    posterContent.style.setProperty('--dynamic-h2-size', `${Math.round(fontSize * 1.375)}px`);
    posterContent.style.setProperty('--dynamic-h3-size', `${Math.round(fontSize * 1.125)}px`);
    posterContent.style.setProperty('--dynamic-h4-size', `${Math.round(fontSize * 1.05)}px`);
    posterContent.style.setProperty('--dynamic-h5-h6-size', `${Math.round(fontSize * 0.95)}px`);
    posterContent.style.setProperty('--dynamic-code-size', `${Math.round(fontSize * 0.875)}px`);
    posterContent.style.setProperty('--dynamic-quote-size', `${Math.round(fontSize * 0.95)}px`);
}

function applyPadding(padding) {
    // 调整外层容器的内边距，即图片中红色箭头指向的边距
    markdownPoster.style.padding = `${padding}px`;
}

function applyWidth(width) {
    // 调整预览区的整体宽度（导出图片的宽度）
    markdownPoster.style.width = `${width}px`;
}

function setupSliders() {
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const paddingSlider = document.getElementById('paddingSlider');
    const paddingValue = document.getElementById('paddingValue');
    const widthSlider = document.getElementById('widthSlider');
    const widthValue = document.getElementById('widthValue');
    
    // 字体大小滑块
    fontSizeSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        fontSizeValue.textContent = `${value}px`;
        // 实时预览
        applyFontSize(value);
    });
    
    // 边距滑块
    paddingSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        paddingValue.textContent = `${value}px`;
        // 实时预览
        applyPadding(value);
    });
    
    // 宽度滑块
    widthSlider.addEventListener('input', function() {
        const value = this.value;
        widthValue.textContent = `${value}px`;
        // 实时预览
        applyWidth(parseInt(value));
    });
    
    // 初始化滑块值显示
    fontSizeValue.textContent = `${fontSizeSlider.value}px`;
    paddingValue.textContent = `${paddingSlider.value}px`;
    widthValue.textContent = `${widthSlider.value}px`;
}


// ===== 导出相关工具 =====
/**
 * 创建一个与预览完全一致的离屏克隆节点用于导出。
 * 关键点：同步计算样式与实际渲染宽度，并统一为 border-box，避免行宽与换行偏差。
 * 返回被追加到 body 的节点，调用方负责移除。
 */
async function createExactExportNode() {
    const clone = markdownPoster.cloneNode(true);
    clone.id = 'madopic-export-poster';
    const mpComputed = getComputedStyle(markdownPoster);
    Object.assign(clone.style, {
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        margin: '0',
        width: `${markdownPoster.getBoundingClientRect().width}px`,
        padding: mpComputed.padding,
        boxSizing: 'border-box',
        background: markdownPoster.style.background || mpComputed.background,
        transform: 'none'
    });
    // 移除内部动画/滤镜但不改变布局
    const inner = clone.querySelector('.poster-content');
    if (inner) {
        const pcComputed = getComputedStyle(posterContent);
        inner.style.animation = 'none';
        inner.style.width = `${posterContent.getBoundingClientRect().width}px`;
        inner.style.padding = pcComputed.padding;
        inner.style.boxSizing = 'border-box';
        inner.style.backdropFilter = pcComputed.backdropFilter || 'none';
        inner.style.webkitBackdropFilter = pcComputed.webkitBackdropFilter || 'none';
    }
    if (currentMode === 'pyq') {
        const rect = markdownPoster.getBoundingClientRect();
        const target = Math.round(rect.width * (2796 / 1290));
        clone.style.height = `${target}px`;
        clone.style.minHeight = `${target}px`;
        clone.style.overflow = 'hidden';

        const mpComputed = getComputedStyle(markdownPoster);
        const paddingTop = parseFloat(mpComputed.paddingTop) || 0;
        const paddingBottom = parseFloat(mpComputed.paddingBottom) || 0;
        const innerMax = Math.max(0, target - paddingTop - paddingBottom);
        const inner = clone.querySelector('.poster-content');
        if (inner) {
            inner.style.maxHeight = `${innerMax}px`;
            inner.style.overflow = 'hidden';
        }
    }
    document.body.appendChild(clone);
    
    // 为导出节点重新渲染数学公式
    const cloneContent = clone.querySelector('.poster-content');
    if (cloneContent) {
        mathRenderer.renderMath(cloneContent);
        
        // 为导出节点的Mermaid图表生成新的唯一ID，避免与原始预览区冲突
        const mermaidContainers = cloneContent.querySelectorAll('.mermaid-container');
        mermaidContainers.forEach((container, index) => {
            const timestamp = Date.now();
            const newId = `export-mermaid-${timestamp}-${index}`;
            container.setAttribute('data-diagram-id', newId);
        });
        
        // 为导出节点重新渲染图表
        await diagramRenderer.renderDiagrams(cloneContent);
        
        // 为导出节点重新渲染ECharts图表
        await echartsRenderer.renderECharts(cloneContent);
        
        // 为导出节点重新渲染卡片
        await cardRenderer.renderCards(cloneContent);
        
        // 额外等待确保所有渲染完成
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 再等待一帧确保DOM更新完成
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
    
    return clone;
}

/**
 * 确保导出节点中的所有图片都可被 html2canvas 捕获。
 * 做法：为每个 <img> 设置 crossorigin/referrerpolicy，并强制等待加载完毕。
 */
async function prepareImagesForExport(root) {
    const images = Array.from(root.querySelectorAll('img'));
    const loadPromises = images.map((img) => new Promise((resolve) => {
        try {
            // 仅导出阶段设置跨域与防盗链（避免影响预览）
            img.setAttribute('crossorigin', 'anonymous');
            img.setAttribute('referrerpolicy', 'no-referrer');
            // 若已完成加载则直接 resolve
            if (img.complete && img.naturalWidth > 0) return resolve();
            // 监听加载/失败
            const clean = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
            };
            const onLoad = () => { clean(); resolve(); };
            const onError = () => {
                clean();
                // 第一次失败，尝试代理加速/绕过 CORS 防盗链
                tryProxyImage(img).finally(resolve);
            };
            img.addEventListener('load', onLoad, { once: true });
            img.addEventListener('error', onError, { once: true });
            // 触发重新加载（给 src 加一个无副作用查询串）。
            // 对 data: 协议不处理；对 blob: 协议尝试转成 dataURL（html2canvas 不抓取跨上下文 blob）
            try {
                if (img.src.startsWith('data:')) {
                    // 已是 dataURL，无需处理
                } else if (img.src.startsWith('blob:')) {
                    // 尝试将 blob 读取为 dataURL
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', img.src, true);
                    xhr.responseType = 'blob';
                    xhr.onload = () => {
                        try {
                            const reader = new FileReader();
                            reader.onload = () => { img.src = reader.result; };
                            reader.onerror = () => {};
                            reader.readAsDataURL(xhr.response);
                        } catch (_) {}
                    };
                    xhr.onerror = () => {};
                    xhr.send();
                } else {
                    const url = new URL(img.src, window.location.href);
                    url.searchParams.set('madopic_cache_bust', Date.now().toString());
                    img.src = url.href;
                }
            } catch (_) {
                // 若 URL 构造失败则忽略
            }
        } catch (_) {
            resolve();
        }
    }));
    await Promise.race([
        Promise.allSettled(loadPromises),
        new Promise((resolve) => setTimeout(resolve, 3000)) // 最多等待 3s，避免卡死
    ]);
}

/**
 * 若图片加载失败，尝试通过公共图片代理服务加载，提升导出命中率。
 * 代理：images.weserv.nl（仅用于 http/https 且跨源情况）。
 */
function tryProxyImage(img) {
    return new Promise((resolve) => {
        try {
            if (img.dataset.madopicProxied === '1') return resolve();
            const original = new URL(img.src, window.location.href);
            // 同源或 data/blob 不代理
            if (original.origin === window.location.origin) return resolve();
            if (original.protocol !== 'http:' && original.protocol !== 'https:') return resolve();

            // 构造代理 URL（去掉协议）
            const hostless = original.href.replace(/^https?:\/\//i, '');
            // 代理默认会设置允许跨域，附带 no-referrer。若原图为 https，确保代理也为 https
            const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(hostless)}&n=-1&output=png`;

            const onLoad = () => { cleanup(); resolve(); };
            const onError = () => { cleanup(); resolve(); };
            const cleanup = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
            };

            img.addEventListener('load', onLoad, { once: true });
            img.addEventListener('error', onError, { once: true });
            img.dataset.madopicProxied = '1';
            img.setAttribute('crossorigin', 'anonymous');
            img.setAttribute('referrerpolicy', 'no-referrer');
            img.src = proxied;
        } catch (_) {
            resolve();
        }
    });
}

/**
 * 导出为 PNG（通过克隆节点离屏渲染，保证与预览一致）。
 * 流程：等待字体 → 克隆节点 → 读取尺寸 → html2canvas 渲染 → 透明边缘裁剪 → 触发下载 → 清理。
 */
async function exportToPNG() {
    if (currentMode === 'xhs') {
        await exportXhsPaginatedPNGs();
        return;
    }

    let exportNode = null;
    try {
        showNotification('正在生成图片...', 'info');
        exportNode = await createExactExportNode();

        // 预处理导出节点中的图片：设置跨域/防盗链属性并强制重新加载，尽量保证可被 html2canvas 捕获
        try {
            await prepareImagesForExport(exportNode);
        } catch (_) {
            // 忽略单个图片处理失败
        }

        // 等待字体与一帧渲染
        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (_) {}
        }
        await new Promise(r => requestAnimationFrame(r));

        // 等待字体与一帧渲染
        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (_) {}
        }
        await new Promise(r => requestAnimationFrame(r));

        const rect = exportNode.getBoundingClientRect();
        const targetWidth = Math.ceil(rect.width);
        const targetHeight = Math.ceil(rect.height);

        const tryScales = getExportScaleCandidates(EXPORT_SCALE);
        const canvas = await renderWithFallbackScales(exportNode, targetWidth, targetHeight, tryScales);

        // 尝试裁剪透明边缘，如果因跨域图片导致失败则跳过裁剪
        let trimmedCanvas = null;
        if (currentMode === 'free') {
            try {
                trimmedCanvas = trimTransparentEdges(canvas);
            } catch (error) {
                console.warn('无法裁剪透明边缘（可能包含跨域图片）:', error.message);
            }
        }
        const outputCanvas = trimmedCanvas || canvas;

        const link = document.createElement('a');
        link.download = `madopic-${getFormattedTimestamp()}.png`;
        link.href = outputCanvas.toDataURL('image/png', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('图片导出成功！', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showNotification('导出失败，请重试', 'error');
    } finally {
        if (exportNode && exportNode.parentNode) {
            exportNode.parentNode.removeChild(exportNode);
        }
    }
}

// 小红书模式分页导出多张 PNG，并可选打包 ZIP
async function exportXhsPaginatedPNGs() {
    let exportNode = null;
    try {
        showNotification('正在生成分页图片...', 'info');
        exportNode = await createExactExportNode();

        // 预处理导出节点中的图片
        try {
            await prepareImagesForExport(exportNode);
        } catch (_) {
            // 忽略单个图片处理失败
        }

        // 去除预览页码，仅保留分隔视觉（导出时每页单独渲染，分隔线会被隐藏）
        exportNode.querySelectorAll('.page-number-indicator').forEach(el => el.remove());

        const pages = Array.from(exportNode.querySelectorAll('.xhs-page'));
        const splitLines = Array.from(exportNode.querySelectorAll('.page-split-line'));

        // 若未分页，回退为单页导出
        if (!pages.length) {
            const rect = exportNode.getBoundingClientRect();
            const tryScales = getExportScaleCandidates(EXPORT_SCALE);
            const canvas = await renderWithFallbackScales(exportNode, Math.ceil(rect.width), Math.ceil(rect.height), tryScales);
            triggerSingleDownload(canvas.toDataURL('image/png', 1.0), `madopic-xhs-${getFormattedTimestamp()}.png`);
            showNotification('图片导出成功！', 'success');
            return;
        }

        const images = [];
        const tryScales = getExportScaleCandidates(EXPORT_SCALE);

        for (let i = 0; i < pages.length; i++) {
            // 仅显示当前页，其余隐藏
            pages.forEach((p, idx) => {
                p.style.display = idx === i ? '' : 'none';
            });
            // 隐藏分隔线
            splitLines.forEach(line => line.style.display = 'none');

            // 等待一帧确保布局稳定
            await new Promise(resolve => requestAnimationFrame(resolve));

            const rect = exportNode.getBoundingClientRect();
            const canvas = await renderWithFallbackScales(exportNode, Math.ceil(rect.width), Math.ceil(rect.height), tryScales);
            images.push(canvas.toDataURL('image/png', 1.0));
        }

        await downloadImagesWithOptionalZip(images);
        showNotification('图片导出成功！', 'success');
    } catch (error) {
        console.error('分页导出失败:', error);
        showNotification('导出失败，请重试', 'error');
    } finally {
        if (exportNode && exportNode.parentNode) {
            exportNode.parentNode.removeChild(exportNode);
        }
    }
}

async function exportToPDF() {
    let exportNode = null;
    try {
        showNotification('正在生成 PDF...', 'info');
        exportNode = await createExactExportNode();

        // 预处理导出节点中的图片
        try {
            await prepareImagesForExport(exportNode);
        } catch (_) {
            // 忽略单个图片处理失败
        }

        // 等待字体与一帧渲染
        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (_) {}
        }
        await new Promise(r => requestAnimationFrame(r));

        const rect = exportNode.getBoundingClientRect();
        const targetWidth = Math.ceil(rect.width);
        const targetHeight = Math.ceil(rect.height);

        const tryScales = getExportScaleCandidates(EXPORT_SCALE);
        const canvas = await renderWithFallbackScales(exportNode, targetWidth, targetHeight, tryScales);

        // 尝试裁剪透明边缘，如果因跨域图片导致失败则跳过裁剪
        let trimmedCanvas = null;
        if (currentMode === 'free') {
            try {
                trimmedCanvas = trimTransparentEdges(canvas);
            } catch (error) {
                console.warn('无法裁剪透明边缘（可能包含跨域图片）:', error.message);
            }
        }
        const outputCanvas = trimmedCanvas || canvas;

        // 创建 PDF
        const { jsPDF } = window.jspdf;
        
        const canvasWidth = outputCanvas.width;
        const canvasHeight = outputCanvas.height;
        
        // 计算 PDF 页面尺寸（毫米）
        // 默认使用 A4 纸张，但根据内容比例调整
        const A4_WIDTH_MM = 210;
        const A4_HEIGHT_MM = 297;
        const aspectRatio = canvasWidth / canvasHeight;
        
        let pdfWidth, pdfHeight, orientation;
        
        if (aspectRatio > 1) {
            orientation = 'landscape';
            pdfWidth = A4_HEIGHT_MM;
            pdfHeight = A4_WIDTH_MM;
            
            if (aspectRatio > pdfWidth / pdfHeight) {
                pdfHeight = pdfWidth / aspectRatio;
            }
        } else {
            orientation = 'portrait';
            pdfWidth = A4_WIDTH_MM;
            pdfHeight = A4_HEIGHT_MM;
            
            if (aspectRatio < pdfWidth / pdfHeight) {
                pdfWidth = pdfHeight * aspectRatio;
            }
        }

        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: [pdfWidth, pdfHeight],
            compress: false
        });

        // 使用 PNG 格式保持高清质量，不压缩
        const imgData = outputCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

        pdf.save(`madopic-${getFormattedTimestamp()}.pdf`);

        showNotification('PDF 导出成功！', 'success');
    } catch (error) {
        console.error('PDF 导出失败:', error);
        showNotification('PDF 导出失败，请重试', 'error');
    } finally {
        if (exportNode && exportNode.parentNode) {
            exportNode.parentNode.removeChild(exportNode);
        }
    }
}

// 导出为独立可打开的 HTML 文件
async function exportToHTML() {
    let exportNode = null;
    try {
        showNotification('正在生成 HTML...', 'info');

        // 并行拉取需要内联的样式
        const cssFetchPromise = Promise.all([
            fetchCssBySelector('link[href*="style.css"]'),
            fetchCssBySelector('link[rel="stylesheet"][href*="katex"]')
        ]);

        // 克隆并渲染离屏节点
        exportNode = await createExactExportNode();

        // 将 ECharts 图表替换为静态图片，确保离线可见
        await replaceEChartsWithImages(exportNode);

        // 收集样式（尽量内联，失败时保留外链兜底）
        const [localCss, katexCss] = await cssFetchPromise;

        // 组装完整 HTML
        const html = buildStandaloneHTML(exportNode, { localCss, katexCss });

        // 触发下载
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `madopic-${getFormattedTimestamp()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('HTML 导出成功！', 'success');
    } catch (error) {
        console.error('HTML 导出失败:', error);
        showNotification('HTML 导出失败，请重试', 'error');
    } finally {
        if (exportNode && exportNode.parentNode) {
            exportNode.parentNode.removeChild(exportNode);
        }
    }
}

// 根据 <link> 选择器抓取 CSS 内容
async function fetchCssBySelector(selector) {
    try {
        const link = document.querySelector(selector);
        if (!link || !link.href) return { inline: '', href: '' };
        const href = link.href;
        const css = await fetchTextSafe(href);
        return { inline: css || '', href };
    } catch (_) {
        return { inline: '', href: '' };
    }
}

// 安全获取文本，失败返回空字符串
async function fetchTextSafe(url) {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return '';
        return await res.text();
    } catch (_) {
        return '';
    }
}

// 将克隆节点中的 ECharts 图表替换为 <img>（使用实例导出的 dataURL）
async function replaceEChartsWithImages(root) {
    const containers = root.querySelectorAll('.echarts-container');
    for (const container of containers) {
        try {
            // chartContainer 是我们在渲染时创建的内部 div，实例挂在其属性上
            const chartContainer = container.querySelector('div[id^="echarts-"]');
            let dataUrl = '';
            if (chartContainer && chartContainer._echartsInstance && typeof chartContainer._echartsInstance.getDataURL === 'function') {
                dataUrl = chartContainer._echartsInstance.getDataURL({ type: 'png', pixelRatio: 1, backgroundColor: '#ffffff' });
            } else {
                // 兜底：合并所有 canvas 层
                const canvases = container.querySelectorAll('canvas');
                if (canvases.length > 0) {
                    const base = canvases[0];
                    const temp = document.createElement('canvas');
                    temp.width = base.width;
                    temp.height = base.height;
                    const tctx = temp.getContext('2d');
                    canvases.forEach(c => {
                        try { tctx.drawImage(c, 0, 0); } catch (_) {}
                    });
                    dataUrl = temp.toDataURL('image/png');
                }
            }

            if (dataUrl) {
                const img = new Image();
                img.src = dataUrl;
                img.style.width = '100%';
                img.style.height = 'auto';
                // 用静态图替换整个容器内容
                container.innerHTML = '';
                container.appendChild(img);
            }
        } catch (_) {
            // 忽略单个失败，继续处理其他图表
        }
    }
}

// 构建可独立打开的 HTML 文本
function buildStandaloneHTML(exportNode, parts) {
    const { localCss, katexCss } = parts || {};
    const title = document.title || 'Madopic Export';

    // 处理样式注入策略：优先内联，失败时保留外链
    const cssBlocks = [];
    if (localCss && localCss.inline) {
        cssBlocks.push(`<style>\n${localCss.inline}\n</style>`);
    } else if (localCss && localCss.href) {
        cssBlocks.push(`<link rel="stylesheet" href="${localCss.href}">`);
    }

    if (katexCss && katexCss.inline) {
        cssBlocks.push(`<style>\n${katexCss.inline}\n</style>`);
    } else if (katexCss && katexCss.href) {
        cssBlocks.push(`<link rel="stylesheet" href="${katexCss.href}">`);
    }

    // 为导出页添加极简 reset，并强制覆盖离屏/滚动样式，确保可见与可滚动
    cssBlocks.push(`<style>\nhtml,body{margin:0;padding:0;background:#f3f4f6;}\nbody{overflow-y:auto !important;overflow-x:hidden;}\n#madopic-export-poster{position:relative !important;top:auto !important;left:auto !important;margin:40px auto !important;display:block !important;transform:none !important;height:auto !important;min-height:0 !important;overflow:visible !important;}\n#madopic-export-poster .poster-content{max-height:none !important;overflow:visible !important;}\n</style>`);

    const head = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${escapeHtml(title)}</title>\n${cssBlocks.join('\n')}\n</head>`;

    // 克隆节点，清理离屏相关 inline 样式
    const node = exportNode.cloneNode(true);
    try {
        node.style.position = '';
        node.style.top = '';
        node.style.left = '';
        node.style.margin = '40px auto';
        node.style.display = 'block';
        node.style.transform = '';
        // 若为固定比例模式（xhs/pyq），取消导出 HTML 的裁剪，保留完整内容
        node.style.height = '';
        node.style.minHeight = '';
        node.style.overflow = 'visible';
        const innerForHtml = node.querySelector('.poster-content');
        if (innerForHtml) {
            innerForHtml.style.maxHeight = '';
            innerForHtml.style.overflow = 'visible';
        }
    } catch (_) {}

    // 仅导出卡片区域，无需运行任何脚本
    const body = `<body>\n${node.outerHTML}\n</body>\n</html>`;

    return `${head}\n${body}`;
}

function escapeHtml(str) {
    try {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    } catch (_) {
        return '' + str;
    }
}

/**
 * 生成按优先级降序的导出 scale 备选列表。
 * 例如：首选 s，然后尝试 2、1.5、1.25、1。
 */
function getExportScaleCandidates(preferred) {
    const candidates = [preferred, 2, 1.5, 1.25, 1];
    const unique = [];
    for (const s of candidates) {
        if (Number.isFinite(s) && s > 0 && !unique.includes(s)) unique.push(s);
    }
    return unique.sort((a, b) => b - a);
}

/**
 * 尝试按多个缩放倍数依次渲染，直到成功为止。
 */
async function renderWithFallbackScales(node, targetWidth, targetHeight, scales) {
    let lastError = null;
    for (const scale of scales) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const canvas = await html2canvas(node, {
                backgroundColor: null,
                scale,
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: targetWidth,
                height: targetHeight,
                windowWidth: targetWidth,
                windowHeight: targetHeight,
                scrollX: 0,
                scrollY: 0,
                imageTimeout: 15000,
                onclone: function(clonedDoc) {
                    const clonedTarget = clonedDoc.getElementById('madopic-export-poster');
                    if (clonedTarget) {
                        clonedTarget.style.setProperty('position', 'absolute', 'important');
                        clonedTarget.style.setProperty('top', '0', 'important');
                        clonedTarget.style.setProperty('left', '0', 'important');
                        clonedTarget.style.setProperty('margin', '0', 'important');
                        clonedTarget.style.setProperty('width', `${currentWidth}px`, 'important');
                        clonedTarget.style.setProperty('padding', `${currentPadding}px`, 'important');
                        clonedTarget.style.setProperty('box-sizing', 'border-box', 'important');
                    }
                    // 再次为克隆文档内的图片设置跨域/防盗链属性（双保险）
                    try {
                        clonedDoc.querySelectorAll('img').forEach((img) => {
                            if (!img.getAttribute('crossorigin')) img.setAttribute('crossorigin', 'anonymous');
                            if (!img.getAttribute('referrerpolicy')) img.setAttribute('referrerpolicy', 'no-referrer');
                            if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'sync');
                            if (!img.getAttribute('loading')) img.setAttribute('loading', 'eager');
                        });
                    } catch (_) {}
                    
                    // 特殊处理KaTeX数学公式元素
                    try {
                        const katexElements = clonedDoc.querySelectorAll('.katex, .katex-display, .katex-mathml');
                        katexElements.forEach(el => {
                            // 确保KaTeX元素的样式被正确保留
                            el.style.setProperty('font-family', 'KaTeX_Main, "Times New Roman", serif', 'important');
                            if (el.classList.contains('katex-display')) {
                                el.style.setProperty('display', 'block', 'important');
                                el.style.setProperty('text-align', 'center', 'important');
                            }
                        });
                    } catch (_) {}
                    
                    // 特殊处理Mermaid图表SVG
                    try {
                        const mermaidSvgs = clonedDoc.querySelectorAll('.mermaid svg');
                        mermaidSvgs.forEach(svg => {
                            // 确保SVG有明确的尺寸和样式
                            if (!svg.getAttribute('width') && svg.getBoundingClientRect) {
                                const rect = svg.getBoundingClientRect();
                                if (rect.width > 0) svg.setAttribute('width', rect.width);
                                if (rect.height > 0) svg.setAttribute('height', rect.height);
                            }
                            svg.style.setProperty('display', 'block', 'important');
                            svg.style.setProperty('max-width', '100%', 'important');
                        });
                    } catch (_) {}
                    
                    clonedDoc.documentElement.style.setProperty('overflow', 'hidden', 'important');
                    clonedDoc.body.style.setProperty('margin', '0', 'important');
                    clonedDoc.body.style.setProperty('padding', '0', 'important');
                }
            });
            if (scale !== scales[0]) {
                showNotification(`显存不足，已自动降至 ${Math.round(scale * 100)}% 清晰度导出`, 'warning');
            }
            return canvas;
        } catch (err) {
            lastError = err;
            // 继续尝试下一个较低的 scale
        }
    }
    throw lastError || new Error('所有缩放倍数均导出失败');
}

// ===== 通知系统 =====
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // 添加样式
    Object.assign(notification.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        background: getNotificationColor(type),
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        fontSize: '14px',
        fontWeight: '500'
    });

    // 如果存在缩放工具栏，则将通知定位到百分比（缩放工具栏）下方
    try {
        const anchor = document.querySelector('.preview-tools') || document.querySelector('.zoom-level');
        if (anchor && typeof anchor.getBoundingClientRect === 'function') {
            const rect = anchor.getBoundingClientRect();
            // fixed 定位采用视口坐标，直接使用 rect.bottom 即可
            const computedTop = Math.max(rect.bottom + 10, 10);
            notification.style.top = `${Math.round(computedTop)}px`;
        } else {
            // 略微下移默认位置，避免遮挡顶部工具栏
            notification.style.top = '120px';
        }
    } catch (e) {
        // 发生异常时退回到略低的默认位置
        notification.style.top = '120px';
    }
    
    notification.querySelector('.notification-content').style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    document.body.appendChild(notification);
    
    // 动画显示
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    return icons[type] || icons.info;
}

function getNotificationColor(type) {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    return colors[type] || colors.info;
}

// ===== 键盘快捷键 =====
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'b':
                    e.preventDefault();
                    handleToolbarAction('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    handleToolbarAction('italic');
                    break;
                case 's':
                    e.preventDefault();
                    exportToPNG();
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    zoomOut();
                    break;
            }
        }
        
        // ESC 键关闭面板
        if (e.key === 'Escape') {
            closeCustomPanel();
        }
    });
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}



// ===== 错误处理 =====
window.addEventListener('error', function(e) {
    console.error('应用错误:', e.error);
    showNotification('应用出现错误，请刷新页面重试', 'error');
});

// 页面可见性改变时优化性能
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 页面隐藏时暂停某些操作
    } else {
        // 页面可见时恢复操作
        updatePreview();
    }
});

// 添加一些实用的格式化快捷方法
const MarkdownHelper = {
    // 插入表格
    insertTable: function(rows = 3, cols = 3) {
        const textarea = markdownInput;
        let table = '\n| ';
        
        // 表头
        for (let i = 0; i < cols; i++) {
            table += `列${i + 1} | `;
        }
        table += '\n| ';
        
        // 分隔线
        for (let i = 0; i < cols; i++) {
            table += '--- | ';
        }
        table += '\n';
        
        // 数据行
        for (let row = 0; row < rows - 1; row++) {
            table += '| ';
            for (let col = 0; col < cols; col++) {
                table += '数据 | ';
            }
            table += '\n';
        }
        
        const cursorPos = textarea.selectionStart;
        const beforeText = textarea.value.substring(0, cursorPos);
        const afterText = textarea.value.substring(cursorPos);
        
        textarea.value = beforeText + table + afterText;
        textarea.setSelectionRange(cursorPos + table.length, cursorPos + table.length);
        updatePreview();
    },
    
    // 插入代码块
    insertCodeBlock: function(language = '') {
        const textarea = markdownInput;
        const codeBlock = `\n\`\`\`${language}\n// 在这里输入代码\nconsole.log('Hello World!');\n\`\`\`\n`;
        
        const cursorPos = textarea.selectionStart;
        const beforeText = textarea.value.substring(0, cursorPos);
        const afterText = textarea.value.substring(cursorPos);
        
        textarea.value = beforeText + codeBlock + afterText;
        textarea.setSelectionRange(cursorPos + 4 + language.length, cursorPos + 4 + language.length);
        updatePreview();
    },
    
    // 通用的插入方法
    insertAtCursor: function(text) {
        const textarea = markdownInput;
        const cursorPos = textarea.selectionStart;
        const beforeText = textarea.value.substring(0, cursorPos);
        const afterText = textarea.value.substring(cursorPos);
        
        textarea.value = beforeText + text + afterText;
        textarea.setSelectionRange(cursorPos + text.length, cursorPos + text.length);
        textarea.focus();
        updatePreview();
    },
    
    // 插入质能守恒公式
    insertEinsteinFormula: function() {
        const formula = `

## 质能守恒定律

$$E = mc^{2}$$

其中：
- $E$ 表示能量
- $m$ 表示质量  
- $c$ 表示光速

`;
        this.insertAtCursor(formula);
    },

    // 插入数学公式模板
    insertMathFormulas: function() {
        const formulas = `

## 常用数学公式

### 代数
**二次公式：** $x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}$

**因式分解：** $a^{2} - b^{2} = (a+b)(a-b)$

### 微积分
**导数定义：** $f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$

**基本积分：** $\\int_a^b f(x)dx = F(b) - F(a)$

### 三角函数
**勾股定理：** $a^{2} + b^{2} = c^{2}$

**正弦定理：** $\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}$

### 统计学
**均值：** $\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i$

**方差：** $\\sigma^{2} = \\frac{1}{n}\\sum_{i=1}^{n} (x_i - \\bar{x})^{2}$

`;
        this.insertAtCursor(formulas);
    },

    // 插入物理公式模板
    insertPhysicsFormulas: function() {
        const formulas = `

## 物理公式集合

### 经典力学
**牛顿第二定律：** $F = ma$

**万有引力定律：** $F = G\\frac{m_1 m_2}{r^{2}}$

**动能：** $E_k = \\frac{1}{2}mv^{2}$

**势能：** $E_p = mgh$

### 电磁学
**库仑定律：** $F = k\\frac{q_1 q_2}{r^{2}}$

**欧姆定律：** $V = IR$

**电功率：** $P = VI = I^{2}R = \\frac{V^{2}}{R}$

### 现代物理
**质能关系：** $E = mc^{2}$

**德布罗意波长：** $\\lambda = \\frac{h}{p}$

**海森堡不确定性原理：** $\\Delta x \\Delta p \\geq \\frac{\\hbar}{2}$

`;
        this.insertAtCursor(formulas);
    },

    // 插入化学公式模板
    insertChemistryFormulas: function() {
        const formulas = `

## 化学公式集合

### 基本化学反应
**燃烧反应：** $\\ce{CH4 + 2O2 -> CO2 + 2H2O}$

**酸碱中和：** $\\ce{HCl + NaOH -> NaCl + H2O}$

**氧化还原：** $\\ce{2Na + Cl2 -> 2NaCl}$

### 有机化学
**甲烷：** $\\ce{CH4}$

**乙醇：** $\\ce{C2H5OH}$

**葡萄糖：** $\\ce{C6H12O6}$

### 化学平衡
**平衡常数：** $K_c = \\frac{[C]^c[D]^d}{[A]^a[B]^b}$

**pH定义：** $pH = -\\log[H^+]$

### 理想气体
**理想气体定律：** $PV = nRT$

`;
        this.insertAtCursor(formulas);
    },

    // 插入流程图
    insertFlowchart: function() {
        const flowchart = `
\`\`\`mermaid
flowchart TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作]
    B -->|否| D[其他操作]
    C --> E[结束]
    D --> E
\`\`\`
`;
        this.insertAtCursor(flowchart);
    },
    
    // 插入序列图
    insertSequenceDiagram: function() {
        const sequenceDiagram = `
\`\`\`mermaid
sequenceDiagram
    participant A as 用户
    participant B as 系统
    A->>B: 发送请求
    B-->>A: 返回响应
    A->>B: 确认收到
\`\`\`
`;
        this.insertAtCursor(sequenceDiagram);
    },
    
    // 插入甘特图
    insertGanttChart: function() {
        const ganttChart = `
\`\`\`mermaid
gantt
    title 项目进度计划
    dateFormat  YYYY-MM-DD
    section 阶段一
    任务1           :a1, 2024-01-01, 30d
    任务2           :after a1, 20d
    section 阶段二
    任务3           :2024-02-01, 25d
    任务4           :20d
\`\`\`
`;
        this.insertAtCursor(ganttChart);
    },
    
    // 插入饼图
    insertPieChart: function() {
        const pieChart = `
\`\`\`mermaid
pie title 数据分布
    "类别A" : 42.96
    "类别B" : 50.05
    "类别C" : 10.01
    "其他" : 5
\`\`\`
`;
        this.insertAtCursor(pieChart);
    },

    // 插入卡片
    insertCard: function() {
        const cardTemplate = `

:::card
**卡片标题**

这是一个精美的卡片内容区域。你可以在这里添加：

- 重要信息
- 产品特色
- 使用说明
- 任何想要突出显示的内容

支持 **粗体**、*斜体*、\`代码\` 和 [链接](https://example.com) 等格式。
:::

**不同类型的卡片示例：**

:::card info
**信息卡片**

这是一个信息类型的卡片，适合展示提示信息。
:::

:::card success
**成功卡片**

这是一个成功类型的卡片，适合展示成功状态。
:::

:::card warning
**警告卡片**

这是一个警告类型的卡片，适合展示注意事项。
:::

:::card error
**错误卡片**

这是一个错误类型的卡片，适合展示错误信息。
:::

`;
        this.insertAtCursor(cardTemplate);
    },

    // 插入ECharts图表模板
    insertEChartsTemplate: function() {
        const echartsTemplate = `

## ECharts 图表示例

### 饼图
\`\`\`echarts
{
  "title": {
    "text": "访问来源统计",
    "left": "center"
  },
  "tooltip": {
    "trigger": "item",
    "formatter": "{a} <br/>{b} : {c} ({d}%)"
  },
  "legend": {
    "orient": "vertical",
    "left": "left",
    "data": ["搜索引擎", "直接访问", "推荐", "其他", "社交平台"]
  },
  "series": [{
    "name": "访问来源",
    "type": "pie",
    "radius": "55%",
    "center": ["50%", "60%"],
    "data": [
      {"value": 10440, "name": "搜索引擎"},
      {"value": 4770, "name": "直接访问"},
      {"value": 2430, "name": "推荐"},
      {"value": 342, "name": "其他"},
      {"value": 18, "name": "社交平台"}
    ]
  }]
}
\`\`\`

### 柱状图
\`\`\`echarts
{
  "title": {
    "text": "月度销售数据",
    "left": "center"
  },
  "tooltip": {
    "trigger": "axis"
  },
  "xAxis": {
    "type": "category",
    "data": ["1月", "2月", "3月", "4月", "5月", "6月"]
  },
  "yAxis": {
    "type": "value"
  },
  "series": [{
    "name": "销售额",
    "type": "bar",
    "data": [120, 200, 150, 80, 70, 110],
    "itemStyle": {
      "color": "#5470c6"
    }
  }]
}
\`\`\`

`;
        this.insertAtCursor(echartsTemplate);
    }
};

// 图片处理相关函数
function insertImage() {
    const imageInput = document.getElementById('imageInput');
    imageInput.click();
}

function setupImageHandlers() {
    const imageInput = document.getElementById('imageInput');
    
    // 文件选择处理
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
        // 清空输入，允许选择同一文件
        e.target.value = '';
    });
    
    // 剪贴板粘贴图片处理
    markdownInput.addEventListener('paste', function(e) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleImageFile(file);
                }
                break;
            }
        }
    });
}

function handleImageFile(file) {
    showNotification('正在处理图片...', 'info');
    
    convertImageToBase64(file)
        .then(base64 => {
            insertImageIntoMarkdown(base64, file.name);
            showNotification('图片插入成功！', 'success');
        })
        .catch(error => {
            console.error('图片处理失败:', error);
            showNotification('图片处理失败，请重试', 'error');
        });
}

function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        reader.onerror = function(error) {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}

function insertImageIntoMarkdown(base64, filename) {
    const textarea = markdownInput;
    const cursorPos = textarea.selectionStart;
    const beforeText = textarea.value.substring(0, cursorPos);
    const afterText = textarea.value.substring(cursorPos);
    
    // 创建简化的图片Markdown语法用于显示（截断base64）
    const base64Header = base64.split(',')[0] + ','; // 保留data:image/xxx;base64,部分
    const base64Data = base64.split(',')[1]; // 获取实际的base64数据
    const shortBase64 = base64Header + base64Data.substring(0, 50) + '...'; // 只显示前50个字符
    
    const imageMarkdown = `\n![${filename}](${shortBase64})\n`;
    
    // 存储完整的图片数据供预览和导出使用
    storeImageData(shortBase64, base64);
    
    // 插入到光标位置
    textarea.value = beforeText + imageMarkdown + afterText;
    textarea.setSelectionRange(cursorPos + imageMarkdown.length, cursorPos + imageMarkdown.length);
    textarea.focus();
    updatePreview();
}

// 存储图片数据映射
function storeImageData(shortBase64, fullBase64) {
    imageDataStore.set(shortBase64, fullBase64);
}

// 替换预览中的简化base64为完整base64
function replaceImageDataForPreview(content) {
    let result = content;
    imageDataStore.forEach((fullBase64, shortBase64) => {
        result = result.replace(new RegExp(escapeRegExp(shortBase64), 'g'), fullBase64);
    });
    return result;
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 生成格式化的时间戳字符串 (YYYYMMDDHHMMSS)
function getFormattedTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function padNumber(num, size = 2) {
    let str = String(num);
    while (str.length < size) str = '0' + str;
    return str;
}

function triggerSingleDownload(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function downloadImagesWithOptionalZip(imageDataUrls) {
    if (!imageDataUrls || !imageDataUrls.length) return;

    const timestamp = getFormattedTimestamp();

    // 若未加载 JSZip 或仅一张，逐张下载
    if (typeof JSZip === 'undefined' || imageDataUrls.length === 1) {
        imageDataUrls.forEach((url, idx) => {
            triggerSingleDownload(url, `madopic-xhs-${padNumber(idx + 1, 2)}-${timestamp}.png`);
        });
        return;
    }

    try {
        const zip = new JSZip();
        imageDataUrls.forEach((url, idx) => {
            const base64 = url.split(',')[1] || '';
            zip.file(`madopic-xhs-${padNumber(idx + 1, 2)}.png`, base64, { base64: true });
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        triggerBlobDownload(blob, `madopic-xhs-${timestamp}.zip`);
    } catch (err) {
        // 兜底：若打包失败，改为逐张下载
        imageDataUrls.forEach((url, idx) => {
            triggerSingleDownload(url, `madopic-xhs-${padNumber(idx + 1, 2)}-${timestamp}.png`);
        });
    }
}

// 获取当前配置（便于调试与外部接入）
function getCurrentMadopicConfig() {
    return {
        width: currentWidth,
        padding: currentPadding,
        fontSize: currentFontSize,
        background: markdownPoster.style.background,
        exportScale: EXPORT_SCALE
    };
}

// 导出全局对象供调试使用
window.MadopicApp = {
    updatePreview,
    exportToPNG,
    exportToPDF,
    applyBackground,
    MarkdownHelper,
    showNotification,
    insertImage,
    handleImageFile,
    getCurrentMadopicConfig,
    mathRenderer,
    diagramRenderer,
    echartsRenderer,
    cardRenderer
};

/**
 * 裁剪画布四周完全透明的像素，去除导出后可能出现的空白边缘。
 * 返回新的裁剪画布；若无需裁剪则返回 null。
 */
function trimTransparentEdges(sourceCanvas) {
    const ctx = sourceCanvas.getContext('2d');
    const { width, height } = sourceCanvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;
    const isRowTransparent = (y) => {
        const base = y * width * 4;
        for (let x = 0; x < width; x++) {
            if (data[base + x * 4 + 3] !== 0) return false;
        }
        return true;
    };
    const isColTransparent = (x, t, b) => {
        for (let y = t; y <= b; y++) {
            const idx = (y * width + x) * 4 + 3;
            if (data[idx] !== 0) return false;
        }
        return true;
    };

    while (top <= bottom && isRowTransparent(top)) top++;
    while (bottom >= top && isRowTransparent(bottom)) bottom--;
    while (left <= right && isColTransparent(left, top, bottom)) left++;
    while (right >= left && isColTransparent(right, top, bottom)) right--;

    // 若全透明或无需要裁剪
    if (top === 0 && left === 0 && right === width - 1 && bottom === height - 1) return null;
    if (top > bottom || left > right) return null;

    const newWidth = right - left + 1;
    const newHeight = bottom - top + 1;
    const trimmed = document.createElement('canvas');
    trimmed.width = newWidth;
    trimmed.height = newHeight;
    const tctx = trimmed.getContext('2d');
    tctx.drawImage(sourceCanvas, left, top, newWidth, newHeight, 0, 0, newWidth, newHeight);
    return trimmed;
}