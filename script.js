// ===== 应用状态管理 =====
const AppState = {
    zoom: 100,
    background: 'gradient1',
    fontSize: 18,
    padding: 24,
    width: 640,
    mode: 'free' // 'free' | 'xhs' | 'pyq'
};

// 为了兼容性，保留旧的全局变量作为访问器
let currentZoom = AppState.zoom;
let currentBackground = AppState.background;
let currentFontSize = AppState.fontSize;
let currentPadding = AppState.padding;
let currentWidth = AppState.width;
let currentMode = AppState.mode;

// ===== 工具函数 =====

/**
 * 防抖函数：延迟执行，在 delay 毫秒内多次调用只执行最后一次
 */
function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 动态加载脚本（懒加载 CDN）
 */
const SCRIPT_INTEGRITY = {
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js": "sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H",
    "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js": "sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3"
};
const loadedScripts = new Set();
const loadingScripts = new Map();
async function loadScript(src) {
    if (loadedScripts.has(src)) return;
    if (src.includes('html2canvas') && typeof html2canvas !== 'undefined') {
        loadedScripts.add(src);
        return;
    }
    if (src.includes('jspdf') && window.jspdf && window.jspdf.jsPDF) {
        loadedScripts.add(src);
        return;
    }
    if (loadingScripts.has(src)) return loadingScripts.get(src);
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        if (SCRIPT_INTEGRITY[src]) {
            script.integrity = SCRIPT_INTEGRITY[src];
            script.crossOrigin = "anonymous";
        }
        const timer = setTimeout(() => {
            script.onload = null;
            script.onerror = null;
            script.remove();
            reject(new Error(`Script loading timed out: ${src}`));
        }, 15000);
        script.onload = () => {
            clearTimeout(timer);
            loadedScripts.add(src);
            resolve();
        };
        script.onerror = () => {
            clearTimeout(timer);
            script.remove();
            reject(new Error(`Unable to load script: ${src}`));
        };
        document.head.appendChild(script);
    }).finally(() => {
        loadingScripts.delete(src);
    });
    loadingScripts.set(src, promise);
    return promise;
}

async function ensureCanvasExportLibLoaded() {
    await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
}

async function ensurePdfExportLibsLoaded() {
    await Promise.all([
        loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'),
        loadScript('https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js')
    ]);
}

function isSafeUrl(value, type = 'link') {
    if (!value) return true;
    const normalized = String(value).replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
    if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) {
        return false;
    }
    if (normalized.startsWith('#') || normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) {
        return true;
    }

    try {
        const parsed = new URL(value, window.location.href);
        if (type === 'image') {
            return ['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol)
                && (!parsed.href.toLowerCase().startsWith('data:') || parsed.href.toLowerCase().startsWith('data:image/'));
        }
        return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
    } catch (_) {
        return false;
    }
}

/**
 * HTML 清理函数：移除潜在的 XSS 攻击代码
 */
function sanitizeHTML(html) {
    // 使用经过安全审计的解析器处理 SVG/MathML、变异 XSS 和危险 URL。
    // CDN 不可用时按纯文本显示，避免回退到不完整的手写过滤器。
    if (typeof DOMPurify === 'undefined') return escapeHtml(html);
    const temp = document.createElement('div');
    temp.innerHTML = DOMPurify.sanitize(html, {
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea'],
        FORBID_ATTR: ['style', 'srcdoc', 'formaction', 'data-dependencies', 'data-src', 'data-jsonp'],
        ALLOW_DATA_ATTR: true
    });

    // 移除危险的属性（on* 事件处理器）
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            const attrName = attr.name.toLowerCase();
            if (attrName.startsWith('on') || attrName === 'srcdoc' || attrName === 'style' || attrName === 'formaction') {
                el.removeAttribute(attr.name);
            }
        });

        if (el.hasAttribute('href')) {
            const href = el.getAttribute('href');
            if (!isSafeUrl(href, 'link')) {
                el.removeAttribute('href');
            } else if (el.tagName.toLowerCase() === 'a') {
                el.setAttribute('rel', 'nofollow noopener noreferrer');
            }
        }
        if (el.hasAttribute('xlink:href') && !isSafeUrl(el.getAttribute('xlink:href'), 'link')) {
            el.removeAttribute('xlink:href');
        }
        if (el.hasAttribute('src')) {
            const src = el.getAttribute('src');
            if (!isSafeUrl(src, 'image')) {
                el.removeAttribute('src');
            }
        }
    });

    return temp.innerHTML;
}

// ===== 撤销/重做管理器 =====
class UndoRedoManager {
    constructor(maxHistory = 50) {
        this.history = [];
        this.index = -1;
        this.maxHistory = maxHistory;
        this.isUndoRedo = false;
    }

    push(state) {
        if (this.isUndoRedo) return;
        if (this.index >= 0 && this.history[this.index] === state) return;
        // 移除当前位置之后的历史
        this.history = this.history.slice(0, this.index + 1);
        this.history.push(state);
        // 限制历史大小
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.index++;
        }
    }

    undo() {
        if (this.index > 0) {
            this.index--;
            return this.history[this.index];
        }
        return null;
    }

    redo() {
        if (this.index < this.history.length - 1) {
            this.index++;
            return this.history[this.index];
        }
        return null;
    }

    canUndo() { return this.index > 0; }
    canRedo() { return this.index < this.history.length - 1; }
}

const undoRedoManager = new UndoRedoManager();

// ===== 自动保存 =====
const AUTOSAVE_KEY = 'madopic_draft';
const AUTOSAVE_SETTINGS_KEY = 'madopic_settings';

function autoSave(content) {
    try {
        localStorage.setItem(AUTOSAVE_KEY, content);
        localStorage.setItem(AUTOSAVE_SETTINGS_KEY, JSON.stringify({
            background: currentBackground,
            fontSize: typeof currentFontSize !== 'undefined' ? currentFontSize : 18,
            width: typeof currentWidth !== 'undefined' ? currentWidth : 640,
            padding: typeof currentPadding !== 'undefined' ? currentPadding : 24,
            mode: typeof currentMode !== 'undefined' ? currentMode : 'free'
        }));
    } catch (e) {
        console.warn('自动保存失败:', e);
        // 用户友好提示：可能是存储空间已满
        if (typeof showNotification === 'function') {
            showNotification('自动保存失败，可能是浏览器存储空间已满', 'warning');
        }
    }
}

function loadDraft() {
    try {
        return localStorage.getItem(AUTOSAVE_KEY);
    } catch (e) {
        console.warn('加载草稿失败:', e);
        if (typeof showNotification === 'function') {
            showNotification('加载草稿失败，将使用默认内容', 'info');
        }
        return null;
    }
}

function loadSettings() {
    try {
        const settings = localStorage.getItem(AUTOSAVE_SETTINGS_KEY);
        return settings ? JSON.parse(settings) : null;
    } catch (e) {
        console.warn('加载设置失败:', e);
        if (typeof showNotification === 'function') {
            showNotification('加载设置失败，将使用默认设置', 'info');
        }
        return null;
    }
}

// ===== 数学公式渲染器 =====
function protectMarkdownSegments(markdown) {
    const segments = [];
    const protect = (text, pattern) => text.replace(pattern, (match) => {
        const token = `\uE000MADOPIC_PROTECTED_${segments.length}\uE001`;
        segments.push(match);
        return token;
    });

    let protectedText = markdown;
    protectedText = protect(protectedText, /```[\s\S]*?```|~~~[\s\S]*?~~~/g);
    protectedText = protect(protectedText, /`[^`\n]*`/g);
    protectedText = protect(protectedText, /!?\[[^\]]*\]\([^\n)]*\)/g);
    protectedText = protect(protectedText, /\$\$[\s\S]*?\$\$/g);
    protectedText = protect(protectedText, /\$(?!\$)(?:\\.|[^$\n])+\$/g);

    return {
        text: protectedText,
        restore(text) {
            return text.replace(/\uE000MADOPIC_PROTECTED_(\d+)\uE001/g, (_, index) => segments[Number(index)] || '');
        }
    };
}

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
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false,
                errorColor: '#cc0000',
                strict: false,
                trust: false,
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
        const protectedMarkdown = protectMarkdownSegments(markdown);
        markdown = protectedMarkdown.text;

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

        return protectedMarkdown.restore(markdown);
    }
}

// 创建全局数学渲染器实例
const mathRenderer = new MathRenderer();

// ===== 图表渲染器 =====
let renderIdCounter = 0;
function nextRenderId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${++renderIdCounter}`;
}

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
            },
            securityLevel: 'strict'
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
        element.textContent = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'diagram-error';
        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-triangle';
        const title = document.createElement('div');
        title.className = 'error-title';
        title.textContent = '图表渲染错误';
        const message = document.createElement('div');
        message.className = 'error-message';
        message.textContent = errorMessage;
        wrapper.append(icon, title, message);
        element.appendChild(wrapper);
        element.classList.add('diagram-error-container');
    }

    // 预处理Markdown中的图表代码
    preprocessDiagram(markdown) {
        // 为每个mermaid代码块生成唯一ID
        let diagramCounter = 0;
        return markdown.replace(/```mermaid\s*\n([\s\S]*?)\n```/g, (match, code) => {
            const diagramId = `mermaid-diagram-${++diagramCounter}`;
            return `\n\n<div class="mermaid-container" data-diagram-id="${diagramId}" data-diagram-code="${encodeURIComponent(code.trim())}"></div>\n\n`;
        });
    }

    // 渲染页面中的所有图表
    async renderDiagrams(container) {
        if (!this.isMermaidLoaded) {
            return;
        }

        const diagramContainers = container.querySelectorAll('.mermaid-container');

        for (const diagramContainer of diagramContainers) {
            try {
                const diagramCode = decodeURIComponent(diagramContainer.getAttribute('data-diagram-code') || '');
                if (diagramCode) {
                    // 不信任 Markdown 中的 DOM ID，也避免预览和并发导出相互覆盖。
                    await this.renderDiagram(diagramContainer, diagramCode, nextRenderId('mermaid'));
                }
            } catch (error) {
                this.showDiagramError(diagramContainer, error.message);
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
        // 使用 WeakMap 存储实例，自动垃圾回收
        this.instances = new WeakMap();
        this.checkEChartsAvailability();
    }

    checkEChartsAvailability() {
        this.isEChartsLoaded = typeof echarts !== 'undefined';
        if (!this.isEChartsLoaded) {
            console.warn('ECharts not loaded. ECharts diagrams will not be rendered.');
        }
    }

    async renderEChart(element, chartConfig, chartId, forExport = false) {
        if (!this.isEChartsLoaded) {
            console.warn('ECharts not available for chart rendering');
            this.showEChartError(element, 'ECharts library not loaded');
            return;
        }

        try {
            // 清理之前的实例（如果存在）
            this.destroy(element);

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
            if (forExport) config.animation = false;

            // 初始化图表
            sanitizeEChartsConfig(config);
            const chart = echarts.init(chartContainer, 'v5');
            const instance = { chart, resizeObserver: null, container: chartContainer };
            // setOption 或 observer 创建失败也必须能销毁已创建的图表。
            this.instances.set(element, instance);
            chart.setOption(config);

            // 响应式调整
            const resizeObserver = new ResizeObserver(() => {
                chart.resize();
            });
            instance.resizeObserver = resizeObserver;
            resizeObserver.observe(chartContainer);

        } catch (error) {
            this.destroy(element);
            console.error('ECharts rendering error:', error);
            this.showEChartError(element, error.message);
        }
    }

    showEChartError(element, errorMessage) {
        element.textContent = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'echarts-error';
        wrapper.style.cssText = `
            padding: 20px;
            border: 2px dashed #ff6b6b;
            border-radius: 8px;
            background-color: #ffe0e0;
            color: #d63031;
            text-align: center;
            font-family: monospace;
        `;
        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-triangle';
        icon.style.marginRight = '8px';
        const text = document.createTextNode(`ECharts Error: ${errorMessage}`);
        wrapper.append(icon, text);
        element.appendChild(wrapper);
    }

    preprocessECharts(markdown) {
        // 处理 ```echarts 代码块
        return markdown.replace(/```echarts\s*\n([\s\S]*?)\n```/g, (match, code) => {
            const chartId = 'echarts-' + Math.random().toString(36).substr(2, 9);
            return `\n\n<div class="echarts-container" data-echarts-id="${chartId}" data-echarts-config="${encodeURIComponent(code.trim())}"></div>\n\n`;
        });
    }

    async renderECharts(container, forExport = false) {
        const echartsElements = container.querySelectorAll('.echarts-container');

        for (const element of echartsElements) {
            try {
                const configData = decodeURIComponent(element.getAttribute('data-echarts-config') || '');
                await this.renderEChart(element, configData, nextRenderId('echarts'), forExport);
            } catch (error) {
                this.showEChartError(element, error.message);
            }
        }
    }

    /**
     * 清理单个 ECharts 实例
     */
    destroy(element) {
        const instance = this.instances.get(element);
        if (instance) {
            try {
                // 断开 ResizeObserver
                if (instance.resizeObserver) {
                    instance.resizeObserver.disconnect();
                }
                // 销毁图表实例
                if (instance.chart) {
                    instance.chart.dispose();
                }
            } catch (e) {
                console.warn('清理 ECharts 实例失败:', e);
            }
            // 从 WeakMap 中删除
            this.instances.delete(element);
        }
    }

    /**
     * 清理指定容器内的所有 ECharts 实例
     */
    destroyAll(container) {
        if (!container) return;

        const echartsElements = container.querySelectorAll('.echarts-container');
        echartsElements.forEach(element => {
            this.destroy(element);
        });
    }
}


// 创建全局 ECharts 渲染器实例
const echartsRenderer = new EChartsRenderer();

// JSON 图表仍含少数 HTML/URL 配置入口，需与 Markdown 使用相同的边界。
function sanitizeEChartsConfig(config) {
    const pending = [config];
    const visited = new WeakSet();
    while (pending.length) {
        const item = pending.pop();
        if (!item || typeof item !== 'object' || visited.has(item)) continue;
        visited.add(item);
        for (const key of Object.keys(item)) {
            const value = item[key];
            if (['__proto__', 'constructor', 'prototype'].includes(key)) {
                delete item[key];
            } else if ((key === 'link' || key === 'sublink') && typeof value === 'string' && !isSafeUrl(value)) {
                delete item[key];
            } else if (key === 'tooltip' && value && typeof value.formatter === 'string') {
                value.formatter = sanitizeHTML(value.formatter);
            } else if (key === 'dataView' && value && typeof value === 'object') {
                if (typeof value.title === 'string') value.title = escapeHtml(value.title);
                if (Array.isArray(value.lang)) value.lang = value.lang.map(escapeHtml);
            }
            if (value && typeof value === 'object') pending.push(value);
        }
    }
}

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
            return `\n\n<div class="card-container" data-card-id="${cardId}" data-card-type="${cardType}" data-card-content="${encodeURIComponent(content.trim())}"></div>\n\n`;
        });
    }

    // 渲染页面中的所有卡片
    async renderCards(container) {
        const cardContainers = container.querySelectorAll('.card-container');

        for (const cardContainer of cardContainers) {
            try {
                const cardId = cardContainer.getAttribute('data-card-id');
                const cardType = cardContainer.getAttribute('data-card-type');
                const cardContent = decodeURIComponent(cardContainer.getAttribute('data-card-content') || '');
                if (cardId && cardContent) {
                    await this.renderCard(cardContainer, cardContent, cardType);
                }
            } catch (error) {
                await this.renderCard(cardContainer, '卡片内容解析失败', 'error');
            }
        }
    }

    // 渲染单个卡片
    async renderCard(element, content, type) {
        try {
            type = ['info', 'success', 'warning', 'error'].includes(type) ? type : 'default';
            // 清除之前的内容
            element.innerHTML = '';

            // 解析卡片内容的Markdown
            let htmlContent = '';
            try {
                htmlContent = marked.parse(replaceImageDataForPreview(content));
                htmlContent = sanitizeHTML(htmlContent);
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
            element.textContent = '';
            const card = document.createElement('div');
            card.className = 'madopic-card';
            const content = document.createElement('div');
            content.className = 'card-content';
            const message = document.createElement('p');
            message.style.color = '#ef4444';
            message.textContent = `卡片渲染失败：${error.message}`;
            content.appendChild(message);
            card.appendChild(content);
            element.appendChild(card);
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
    gradient1: 'linear-gradient(135deg, #A755F7 0%, #7275F2 50%, #6C23AA 100%)',
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

// 图片数据存储（使用 Map 提供更好的性能）
const imageDataStore = new Map();
let hasShownImagePersistenceWarning = false;

const ImagePersistence = {
    databaseName: 'madopic',
    databaseVersion: 1,
    storeName: 'images',
    databasePromise: null,

    open() {
        if (typeof indexedDB === 'undefined') {
            return Promise.reject(new Error('IndexedDB is unavailable'));
        }
        if (this.databasePromise) return this.databasePromise;

        this.databasePromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.databaseName, this.databaseVersion);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(this.storeName)) {
                    database.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
                const database = request.result;
                database.onversionchange = () => database.close();
                resolve(database);
            };
            request.onerror = () => reject(request.error || new Error('Unable to open image storage'));
            request.onblocked = () => reject(new Error('Image storage upgrade is blocked'));
        }).catch((error) => {
            this.databasePromise = null;
            throw error;
        });

        return this.databasePromise;
    },

    async loadAll(references = null) {
        const database = await this.open();
        const records = await new Promise((resolve, reject) => {
            const transaction = database.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const loaded = [];
            if (references === null) {
                const request = store.getAll();
                request.onsuccess = () => loaded.push(...(request.result || []));
            } else {
                // 只将当前草稿引用的图片载入内存，历史记录仍保留在数据库。
                for (const reference of new Set(references)) {
                    const request = store.get(reference);
                    request.onsuccess = () => { if (request.result) loaded.push(request.result); };
                }
            }
            transaction.oncomplete = () => resolve(loaded);
            transaction.onerror = () => reject(transaction.error || new Error('Unable to load saved images'));
            transaction.onabort = () => reject(transaction.error || new Error('Image loading was aborted'));
        });

        records.forEach((record) => {
            if (record && typeof record.id === 'string' && typeof record.dataUrl === 'string') {
                imageDataStore.set(record.id, record.dataUrl);
            }
        });
        return records.length;
    },

    async save(id, dataUrl) {
        const database = await this.open();
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(this.storeName, 'readwrite');
            transaction.objectStore(this.storeName).put({ id, dataUrl });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('Unable to save image'));
            transaction.onabort = () => reject(transaction.error || new Error('Image save was aborted'));
        });
    }
};

// 预览渲染状态
let hasInitialPreviewRendered = false;
let lastRenderedMarkdown = '';
let pendingPreviewMarkdown = null;
let previewRenderPromise = null;

// 初始化应用
async function bootstrapApp() {
    initializeApp();
    setupEventListeners();
    await initOptimizations();
    await updatePreview();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
    bootstrapApp();
}

// 初始化应用
function initializeApp() {
    // 配置 marked 选项
    marked.setOptions({
        breaks: true,
        gfm: true,
        // 安全性：启用 HTML 清理以防止 XSS 攻击
        // 注意：marked 的 sanitize 在新版本中已废弃，建议使用 DOMPurify
        // 这里保持 false 以支持自定义 HTML，但在实际渲染时应手动清理
        sanitize: false,
        highlight: function (code, lang) {
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
            btn.setAttribute('aria-pressed', String(btn.getAttribute('data-mode') === mode));
        });
    }
    // 预览区域视觉反馈（仅预览容器外层，不改导出逻辑）
    applyPreviewModeFrame();
}

function applyPreviewModeFrame() {
    // 预览时根据模式设置固定可视高度（以外层 markdownPoster 的 box 包含 padding 与内容）
    markdownPoster.dataset.mode = currentMode;
    if (currentMode === 'xhs') {
        // 3:4（宽:高） => 高度 = 宽度 / 3 * 4。由于 width 是含 padding 的可视宽度，这里与导出一致
        const rect = markdownPoster.getBoundingClientRect();
        const targetHeight = Math.round((rect.width / 3) * 4);
        markdownPoster.style.height = `${targetHeight}px`;
        markdownPoster.style.minHeight = `${targetHeight}px`;
        markdownPoster.style.overflow = 'hidden'; // 超出裁掉

        // 计算可用给白卡片（posterContent）的最大高度，保留上下紫色 padding
        const mpComputed = getComputedStyle(markdownPoster);
        const paddingTop = parseFloat(mpComputed.paddingTop) || 0;
        const paddingBottom = parseFloat(mpComputed.paddingBottom) || 0;
        const innerMax = Math.max(0, targetHeight - paddingTop - paddingBottom);
        posterContent.style.maxHeight = `${innerMax}px`;
        posterContent.style.overflow = 'hidden';
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
        markdownPoster.style.overflow = 'hidden';
        posterContent.style.maxHeight = '';
        posterContent.style.overflow = '';
    }
}

// 设置工具栏按钮
function setupToolbarButtons() {
    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', function () {
            const action = this.getAttribute('data-action');
            handleToolbarAction(action);
        });
    });
}

function applyEditorChange(nextValue, selectionStart, selectionEnd = selectionStart, options = {}) {
    if (!markdownInput) return;

    const { focus = true, recordHistory = true } = options;
    const previousValue = markdownInput.value;

    if (recordHistory && undoRedoManager.history[undoRedoManager.index] !== previousValue) {
        undoRedoManager.push(previousValue);
    }

    markdownInput.value = nextValue;
    const safeStart = Math.max(0, Math.min(selectionStart, nextValue.length));
    const safeEnd = Math.max(safeStart, Math.min(selectionEnd, nextValue.length));
    markdownInput.setSelectionRange(safeStart, safeEnd);

    if (recordHistory && undoRedoManager.history[undoRedoManager.index] !== nextValue) {
        undoRedoManager.push(nextValue);
    }

    updateLineNumbers();
    updatePreview();
    if (focus) markdownInput.focus();
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

    switch (action) {
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
            applyEditorChange('', 0, 0);
            return;
    }

    applyEditorChange(beforeText + insertText + afterText, cursorPos, cursorPos);
}

// 更新预览
function updatePreview() {
    // 自动保存草稿
    autoSave(markdownInput.value);
    pendingPreviewMarkdown = markdownInput.value.trim();
    if (!previewRenderPromise) {
        // 同一时间只运行一条管线；快速输入合并为最新内容。
        previewRenderPromise = Promise.resolve().then(async () => {
            while (pendingPreviewMarkdown !== null) {
                const markdownText = pendingPreviewMarkdown;
                pendingPreviewMarkdown = null;
                if (hasInitialPreviewRendered && markdownText === lastRenderedMarkdown) continue;
                await renderPreview(markdownText);
            }
        }).finally(() => {
            previewRenderPromise = null;
        });
    }
    return previewRenderPromise;
}

async function renderPreview(markdownText) {
    updateLineNumbers();
    // WeakMap 不会释放 ECharts 内部注册表和 ResizeObserver，需主动销毁。
    echartsRenderer.destroyAll(posterContent);

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

    let htmlContent = '';
    try {
        htmlContent = marked.parse(processedMarkdown);
        // 安全性：清理潜在的 XSS 攻击代码
        htmlContent = sanitizeHTML(htmlContent);
    } catch (err) {
        console.error('Markdown 渲染失败: ', err);
        htmlContent = '<p style="color:#ef4444">渲染失败，请检查 Markdown 内容。</p>';
        if (typeof showNotification === 'function') {
            showNotification('Markdown 渲染失败，请检查内容格式', 'error');
        }
    }
    posterContent.innerHTML = htmlContent;

    // 渲染数学公式
    mathRenderer.renderMath(posterContent);

    // 渲染图表
    await diagramRenderer.renderDiagrams(posterContent);
    if (pendingPreviewMarkdown !== null && pendingPreviewMarkdown !== markdownText) return;

    // 渲染 ECharts 图表
    await echartsRenderer.renderECharts(posterContent);
    if (pendingPreviewMarkdown !== null && pendingPreviewMarkdown !== markdownText) return;

    // 渲染卡片
    await cardRenderer.renderCards(posterContent);
    if (pendingPreviewMarkdown !== null && pendingPreviewMarkdown !== markdownText) return;

    // 代码高亮（Prism.js）
    if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(posterContent);
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
    lastRenderedMarkdown = markdownText;
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
let activeSettingsPanel = null;
let settingsPanelTrigger = null;
let settingsPanelBackground = [];

function openSettingsPanel(panel, triggerId) {
    if (activeSettingsPanel) closeAllPanels();
    settingsPanelTrigger = document.activeElement;
    settingsPanelBackground = Array.from(document.querySelectorAll('.toolbar, .main-content'))
        .map(element => ({ element, inert: element.inert }));
    settingsPanelBackground.forEach(({ element }) => { element.inert = true; });
    activeSettingsPanel = panel;
    panel.inert = false;
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('active');
    document.getElementById(triggerId).setAttribute('aria-expanded', 'true');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    panel.querySelector('button, input, select, [tabindex="0"]')?.focus();
}

function openBackgroundPanel() {
    openSettingsPanel(backgroundPanel, 'backgroundBtn');
}

function closeBackgroundPanel() {
    closeAllPanels();
}

// 文字布局设置面板
function openLayoutPanel() {
    openSettingsPanel(layoutPanel, 'layoutBtn');
}

function closeLayoutPanel() {
    closeAllPanels();
}

// 关闭所有面板
function closeAllPanels() {
    const trigger = settingsPanelTrigger;
    activeSettingsPanel = null;
    settingsPanelTrigger = null;
    settingsPanelBackground.forEach(({ element, inert }) => { element.inert = inert; });
    settingsPanelBackground = [];
    if (trigger) {
        const focusTarget = trigger.getClientRects().length ? trigger : document.getElementById('hamburgerBtn');
        focusTarget?.focus();
    }
    [backgroundPanel, layoutPanel].forEach(panel => {
        panel.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
        panel.inert = true;
    });
    ['backgroundBtn', 'layoutBtn'].forEach(id => document.getElementById(id).setAttribute('aria-expanded', 'false'));
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function setupBackgroundPresets() {
    document.querySelectorAll('.bg-preset').forEach(preset => {
        preset.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                preset.click();
            }
        });
        preset.addEventListener('click', function () {
            // 移除其他选中状态
            document.querySelectorAll('.bg-preset').forEach(p => {
                p.classList.remove('active');
                p.setAttribute('aria-pressed', 'false');
            });
            // 添加选中状态
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');
            currentBackground = this.getAttribute('data-bg');
        });
    });
}

function setupColorInputs() {
    const colorStart = document.getElementById('colorStart');
    const colorEnd = document.getElementById('colorEnd');
    const gradientDirection = document.getElementById('gradientDirection');

    [colorStart, colorEnd, gradientDirection].forEach(input => {
        input.addEventListener('change', function () {
            // 取消预设选择
            document.querySelectorAll('.bg-preset').forEach(p => {
                p.classList.remove('active');
                p.setAttribute('aria-pressed', 'false');
            });
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
    // 调整白色内容卡片的内边距，即文字到紫色背景之间的留白
    posterContent.style.padding = `${padding}px`;
}

function applyWidth(width) {
    // 调整预览区的整体宽度（导出图片的宽度）
    markdownPoster.style.width = `${width}px`;
    applyPreviewModeFrame();
}

function setupSliders() {
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const paddingSlider = document.getElementById('paddingSlider');
    const paddingValue = document.getElementById('paddingValue');
    const widthSlider = document.getElementById('widthSlider');
    const widthValue = document.getElementById('widthValue');

    // 字体大小滑块
    fontSizeSlider.addEventListener('input', function () {
        const value = parseFloat(this.value);
        fontSizeValue.textContent = `${value}px`;
        // 实时预览
        applyFontSize(value);
    });

    // 边距滑块
    paddingSlider.addEventListener('input', function () {
        const value = parseFloat(this.value);
        paddingValue.textContent = `${value}px`;
        // 实时预览
        applyPadding(value);
    });

    // 宽度滑块
    widthSlider.addEventListener('input', function () {
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
    // 输入防抖尚未触发或图表仍在渲染时，导出也必须包含最新内容。
    await updatePreview();
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
    // 固定高度模式：小红书 3:4。导出时必须与预览一致，且裁掉超出部分
    if (currentMode === 'xhs') {
        const rect = markdownPoster.getBoundingClientRect();
        const target = Math.round((rect.width / 3) * 4);
        clone.style.height = `${target}px`;
        clone.style.minHeight = `${target}px`;
        clone.style.overflow = 'hidden';

        // 同步内部白卡片最大高度，保留上下紫色 padding 作为边距
        const mpComputed = getComputedStyle(markdownPoster);
        const paddingTop = parseFloat(mpComputed.paddingTop) || 0;
        const paddingBottom = parseFloat(mpComputed.paddingBottom) || 0;
        const innerMax = Math.max(0, target - paddingTop - paddingBottom);
        const inner = clone.querySelector('.poster-content');
        if (inner) {
            inner.style.maxHeight = `${innerMax}px`;
            inner.style.overflow = 'hidden';
        }
    } else if (currentMode === 'pyq') {
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

    try {
        // 为导出节点重新渲染数学公式
        const cloneContent = clone.querySelector('.poster-content');
        if (cloneContent) {
            mathRenderer.renderMath(cloneContent);

            // 为导出节点重新渲染图表
            await diagramRenderer.renderDiagrams(cloneContent);

            // 为导出节点重新渲染ECharts图表
            await echartsRenderer.renderECharts(cloneContent, true);

            // 为导出节点重新渲染卡片
            await cardRenderer.renderCards(cloneContent);

            // 再等待一帧确保DOM更新完成
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        return clone;
    } catch (error) {
        removeExportNode(clone);
        throw error;
    }
}

function removeExportNode(node) {
    if (!node) return;
    echartsRenderer.destroyAll(node);
    node.remove();
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
            const timer = setTimeout(() => { clean(); resolve(); }, 3000);
            const clean = () => {
                clearTimeout(timer);
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
                            reader.onerror = () => { };
                            reader.readAsDataURL(xhr.response);
                        } catch (_) { }
                    };
                    xhr.onerror = () => { };
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
    await Promise.allSettled(loadPromises);
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
            const timer = setTimeout(() => { cleanup(); resolve(); }, 3000);
            const cleanup = () => {
                clearTimeout(timer);
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
let exportInProgress = false;
function beginExport() {
    if (exportInProgress) {
        showNotification('正在导出，请稍候...', 'info');
        return false;
    }
    exportInProgress = true;
    return true;
}

async function exportToPNG() {
    if (!beginExport()) return;
    let exportNode = null;
    try {
        showNotification('正在生成图片...', 'info');

        // 懒加载导出所需的库
        await ensureCanvasExportLibLoaded();

        exportNode = await createExactExportNode();

        // 预处理导出节点中的图片：设置跨域/防盗链属性并强制重新加载，尽量保证可被 html2canvas 捕获
        try {
            await prepareImagesForExport(exportNode);
        } catch (_) {
            // 忽略单个图片处理失败
        }

        // 等待字体与一帧渲染
        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (_) { }
        }
        await new Promise(r => requestAnimationFrame(r));

        const rect = exportNode.getBoundingClientRect();
        const targetWidth = Math.ceil(rect.width);
        const targetHeight = Math.ceil(rect.height);

        // Canvas 尺寸预检查（浏览器限制通常为 32767px）
        const maxCanvasSize = 32767;
        const estimatedHeight = targetHeight * EXPORT_SCALE;
        if (estimatedHeight > maxCanvasSize) {
            showNotification(`内容过长（约${Math.round(estimatedHeight)}px），可能导致导出失败。建议缩短内容或降低导出比例。`, 'warning');
        }

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

        // 直接编码为 Blob，避免额外分配完整 Base64 字符串。
        let blob;
        try {
            blob = await new Promise((resolve, reject) => {
                outputCanvas.toBlob(result => result ? resolve(result) : reject(new Error('Unable to encode PNG')), 'image/png');
            });
        } catch (encodingError) {
            console.error('PNG 编码失败:', encodingError);
            if (encodingError.name === 'SecurityError') {
                showNotification('导出失败：图片包含跨域资源，无法导出。请移除外部图片后重试。', 'error');
            } else {
                showNotification('导出失败：无法生成图片数据。请尝试缩短内容。', 'error');
            }
            return;
        }

        downloadBlob(blob, 'png');

        showNotification('图片导出成功！', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        // 提供更具体的错误信息
        let errorMsg = '导出失败，请重试';
        if (error.message) {
            if (error.message.includes('缩放倍数')) {
                errorMsg = '导出失败：内容过大，请缩短内容后重试';
            } else if (error.message.includes('tainted') || error.message.includes('cross-origin')) {
                errorMsg = '导出失败：包含跨域图片，请移除外部图片后重试';
            } else if (error.message.includes('memory') || error.message.includes('heap')) {
                errorMsg = '导出失败：内存不足，请缩短内容或关闭其他页面后重试';
            }
        }
        showNotification(errorMsg, 'error');
    } finally {
        removeExportNode(exportNode);
        exportInProgress = false;
    }
}

async function exportToPDF() {
    if (!beginExport()) return;
    let exportNode = null;
    try {
        showNotification('正在生成可编辑 PDF...', 'info');
        await ensurePdfExportLibsLoaded();

        exportNode = await createExactExportNode();

        try {
            await prepareImagesForExport(exportNode);
        } catch (_) {
            // 忽略单个图片处理失败
        }
        await replaceEChartsWithImages(exportNode);

        if (document.fonts && document.fonts.ready) {
            try { await document.fonts.ready; } catch (_) { }
        }
        await new Promise(r => requestAnimationFrame(r));

        try {
            await exportEditablePDF(exportNode);
            showNotification('可编辑 PDF 导出成功！', 'success');
        } catch (editableError) {
            console.warn('可编辑 PDF 生成失败，回退为图片 PDF:', editableError);
            await exportRasterPDF(exportNode);
            showNotification('可编辑 PDF 生成失败，已自动导出兼容图片 PDF', 'warning');
        }
    } catch (error) {
        console.error('PDF 导出失败:', error);
        showNotification('PDF 导出失败，请重试', 'error');
    } finally {
        removeExportNode(exportNode);
        exportInProgress = false;
    }
}

const PDF_EDITABLE_FONT_URL = 'https://raw.githubusercontent.com/lxgw/LxgwWenKaiGB/main/fonts/TTF/LXGWWenKaiGB-Regular.ttf';
let editablePdfFontPromise = null;

async function loadEditablePdfFont() {
    if (!editablePdfFontPromise) {
        editablePdfFontPromise = fetch(PDF_EDITABLE_FONT_URL, { cache: 'force-cache', signal: AbortSignal.timeout(20000) })
            .then(response => {
                if (!response.ok) throw new Error(`中文字体加载失败（${response.status}）`);
                return response.arrayBuffer();
            })
            .then(arrayBufferToBase64)
            .catch(error => {
                editablePdfFontPromise = null;
                throw error;
            });
    }
    return editablePdfFontPromise;
}

function arrayBufferToBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const chunks = [];
    const chunkSize = 32768;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        chunks.push(String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize)));
    }
    return btoa(chunks.join(''));
}

function setPdfExportPosition(node) {
    Object.assign(node.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        margin: '0',
        transform: 'none'
    });
}

function preparePdfBackgroundNode(sourceNode) {
    const node = sourceNode.cloneNode(true);
    setPdfExportPosition(node);
    node.querySelectorAll('*').forEach(element => {
        // 公式与图表保留为视觉底图；普通正文会由 PDF 文本层重新绘制。
        if (!element.closest('.katex, .mermaid-container, .echarts-container')) {
            element.style.setProperty('color', 'transparent', 'important');
            element.style.setProperty('text-shadow', 'none', 'important');
        }
    });
    return node;
}

function preparePdfTextNode(sourceNode) {
    const node = sourceNode.cloneNode(true);
    setPdfExportPosition(node);
    node.style.setProperty('background', 'transparent', 'important');
    node.style.setProperty('box-shadow', 'none', 'important');
    node.style.fontFamily = 'LXGWWenKaiGB';

    node.querySelectorAll('*').forEach(element => {
        element.style.setProperty('background', 'transparent', 'important');
        element.style.setProperty('box-shadow', 'none', 'important');
        element.style.setProperty('border-color', 'transparent', 'important');
        element.style.setProperty('outline', 'none', 'important');

        const isRasterVisual = element.matches('img, svg, canvas, video, iframe')
            || element.closest('.katex, .mermaid-container, .echarts-container');
        if (isRasterVisual) {
            element.style.setProperty('visibility', 'hidden', 'important');
        } else {
            element.style.setProperty('font-family', 'LXGWWenKaiGB', 'important');
        }
    });
    return node;
}

async function exportEditablePDF(sourceNode) {
    // 立即等待字体失败，避免截图期间产生未处理的 Promise rejection。
    const fontBase64 = await loadEditablePdfFont();
    const rect = sourceNode.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    const backgroundNode = preparePdfBackgroundNode(sourceNode);
    document.body.appendChild(backgroundNode);
    let backgroundCanvas;
    try {
        backgroundCanvas = await html2canvas(backgroundNode, {
            backgroundColor: null,
            scale: 1,
            useCORS: true,
            allowTaint: false,
            logging: false,
            width,
            height,
            windowWidth: width,
            windowHeight: height
        });
    } finally {
        backgroundNode.remove();
    }

    const textNode = preparePdfTextNode(sourceNode);
    document.body.appendChild(textNode);
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [width, height],
            hotfixes: ['px_scaling'],
            compress: true,
            putOnlyUsedFonts: true
        });

        pdf.addImage(backgroundCanvas.toDataURL('image/png'), 'PNG', 0, 0, width, height, undefined, 'FAST');
        pdf.addFileToVFS('LXGWWenKaiGB-Regular.ttf', fontBase64);
        pdf.addFont('LXGWWenKaiGB-Regular.ttf', 'LXGWWenKaiGB', 'normal');
        pdf.addFont('LXGWWenKaiGB-Regular.ttf', 'LXGWWenKaiGB', 'bold');
        pdf.setFont('LXGWWenKaiGB', 'normal');

        await pdf.html(textNode, {
            x: 0,
            y: 0,
            width,
            windowWidth: width,
            autoPaging: false,
            html2canvas: {
                backgroundColor: null,
                scale: 1,
                useCORS: true,
                allowTaint: false,
                logging: false
            }
        });

        pdf.save(`madopic-${getFormattedTimestamp()}.pdf`);
    } finally {
        textNode.remove();
    }
}

async function exportRasterPDF(exportNode) {
    const rect = exportNode.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    const canvas = await renderWithFallbackScales(
        exportNode,
        width,
        height,
        getExportScaleCandidates(EXPORT_SCALE)
    );
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
        hotfixes: ['px_scaling'],
        compress: true
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height, undefined, 'FAST');
    pdf.save(`madopic-${getFormattedTimestamp()}.pdf`);
}

// 导出为独立可打开的 HTML 文件
async function exportToHTML() {
    if (!beginExport()) return;
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
        downloadBlob(blob, 'html');

        showNotification('HTML 导出成功！', 'success');
    } catch (error) {
        console.error('HTML 导出失败:', error);
        showNotification('HTML 导出失败，请重试', 'error');
    } finally {
        removeExportNode(exportNode);
        exportInProgress = false;
    }
}

function downloadBlob(blob, extension) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    try {
        link.href = url;
        link.download = `madopic-${getFormattedTimestamp()}.${extension}`;
        document.body.appendChild(link);
        link.click();
    } finally {
        link.remove();
        // 给浏览器启动下载的机会后释放 URL。
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

// 根据 <link> 选择器抓取 CSS 内容
async function fetchCssBySelector(selector) {
    try {
        const link = document.querySelector(selector);
        if (!link || !link.href) return { inline: '', href: '' };
        const href = link.href;
        const css = await fetchTextSafe(href, link.integrity);
        // 内联后相对字体路径的基准已变化，改成原样式表的绝对 URL。
        const inline = (css || '').replace(/url\(\s*(["']?)(.*?)\1\s*\)/g, (match, quote, value) => {
            if (!value || value.startsWith('#') || value.startsWith('data:')) return match;
            try { return `url("${new URL(value, href).href}")`; } catch (_) { return match; }
        });
        return { inline, href };
    } catch (_) {
        return { inline: '', href: '' };
    }
}

// 安全获取文本，失败返回空字符串
async function fetchTextSafe(url, integrity = '') {
    try {
        const res = await fetch(url, { mode: 'cors', integrity, signal: AbortSignal.timeout(15000) });
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
            // 从渲染器获取真实实例，同时支持 Canvas 与 SVG 渲染模式。
            const instance = echartsRenderer.instances.get(container);
            let dataUrl = '';
            if (instance && instance.chart) {
                dataUrl = instance.chart.getDataURL({ type: 'png', pixelRatio: 1, backgroundColor: '#ffffff' });
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
                        try { tctx.drawImage(c, 0, 0); } catch (_) { }
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
                echartsRenderer.destroy(container);
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
        cssBlocks.push(`<link rel="stylesheet" href="${escapeHtml(localCss.href)}">`);
    }

    if (katexCss && katexCss.inline) {
        cssBlocks.push(`<style>\n${katexCss.inline}\n</style>`);
    } else if (katexCss && katexCss.href) {
        cssBlocks.push(`<link rel="stylesheet" href="${escapeHtml(katexCss.href)}">`);
    }

    // 为导出页添加极简 reset，并强制覆盖离屏/滚动样式，确保可见与可滚动
    cssBlocks.push(`<style>\nhtml,body{margin:0;padding:0;background:#f3f4f6;}\nbody{overflow-y:auto !important;overflow-x:hidden;}\n#madopic-export-poster{position:relative !important;top:auto !important;left:auto !important;margin:40px auto !important;display:block !important;transform:none !important;height:auto !important;min-height:0 !important;overflow:visible !important;}\n#madopic-export-poster .poster-content{max-height:none !important;overflow:visible !important;}\n</style>`);

    const head = `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; base-uri 'none'; form-action 'none'">\n<meta name="referrer" content="no-referrer">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${escapeHtml(title)}</title>\n${cssBlocks.join('\n')}\n</head>`;

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
    } catch (_) { }

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
            if (Math.ceil(targetWidth * scale) > 32767 || Math.ceil(targetHeight * scale) > 32767) {
                throw new Error('Canvas exceeds maximum dimensions at this scale');
            }
            // eslint-disable-next-line no-await-in-loop
            const canvas = await html2canvas(node, {
                backgroundColor: null,
                scale,
                useCORS: true,
                allowTaint: false, // 改为 false，避免 canvas 被污染导致 toDataURL() 失败
                logging: false,
                width: targetWidth,
                height: targetHeight,
                windowWidth: targetWidth,
                windowHeight: targetHeight,
                scrollX: 0,
                scrollY: 0,
                imageTimeout: 15000,
                onclone: function (clonedDoc) {
                    const clonedTarget = clonedDoc.getElementById('madopic-export-poster');
                    if (clonedTarget) {
                        clonedTarget.style.setProperty('position', 'absolute', 'important');
                        clonedTarget.style.setProperty('top', '0', 'important');
                        clonedTarget.style.setProperty('left', '0', 'important');
                        clonedTarget.style.setProperty('margin', '0', 'important');
                        clonedTarget.style.setProperty('width', `${targetWidth}px`, 'important');
                        clonedTarget.style.setProperty('padding', getComputedStyle(markdownPoster).padding, 'important');
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
                    } catch (_) { }

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
                    } catch (_) { }

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
                    } catch (_) { }

                    clonedDoc.documentElement.style.setProperty('overflow', 'hidden', 'important');
                    clonedDoc.body.style.setProperty('margin', '0', 'important');
                    clonedDoc.body.style.setProperty('padding', '0', 'important');
                }
            });
            if (!canvas.width || !canvas.height) throw new Error('Canvas rendering returned an empty image');
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
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const content = document.createElement('div');
    content.className = 'notification-content';
    const icon = document.createElement('i');
    icon.className = `fas ${getNotificationIcon(type)}`;
    const text = document.createElement('span');
    text.textContent = message;
    content.append(icon, text);
    notification.appendChild(content);

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

    content.style.cssText = `
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
    document.addEventListener('keydown', function (e) {
        if (activeSettingsPanel) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeAllPanels();
            } else if (e.key === 'Tab') {
                const focusable = Array.from(activeSettingsPanel.querySelectorAll('button, input, select, [tabindex="0"]'))
                    .filter(element => !element.disabled);
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && (document.activeElement === first || !activeSettingsPanel.contains(document.activeElement))) {
                    e.preventDefault();
                    last?.focus();
                } else if (!e.shiftKey && (document.activeElement === last || !activeSettingsPanel.contains(document.activeElement))) {
                    e.preventDefault();
                    first?.focus();
                }
            }
            return;
        }
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
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
            closeAllPanels();
        }
    });
}

// ===== 错误处理 =====
window.addEventListener('error', function (e) {
    console.error('应用错误:', e.error);
    showNotification('应用出现错误，请刷新页面重试', 'error');
});

// 页面可见性改变时优化性能
document.addEventListener('visibilitychange', function () {
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
    insertTable: function (rows = 3, cols = 3) {
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

        applyEditorChange(
            beforeText + table + afterText,
            cursorPos + table.length,
            cursorPos + table.length,
            { focus: false }
        );
    },

    // 插入代码块
    insertCodeBlock: function (language = '') {
        const textarea = markdownInput;
        const codeBlock = `\n\`\`\`${language}\n// 在这里输入代码\nconsole.log('Hello World!');\n\`\`\`\n`;

        const cursorPos = textarea.selectionStart;
        const beforeText = textarea.value.substring(0, cursorPos);
        const afterText = textarea.value.substring(cursorPos);

        applyEditorChange(
            beforeText + codeBlock + afterText,
            cursorPos + 4 + language.length,
            cursorPos + 4 + language.length,
            { focus: false }
        );
    },

    // 通用的插入方法
    insertAtCursor: function (text) {
        const textarea = markdownInput;
        const cursorPos = textarea.selectionStart;
        const beforeText = textarea.value.substring(0, cursorPos);
        const afterText = textarea.value.substring(cursorPos);

        applyEditorChange(
            beforeText + text + afterText,
            cursorPos + text.length,
            cursorPos + text.length
        );
    },

    // 插入质能守恒公式
    insertEinsteinFormula: function () {
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
    insertMathFormulas: function () {
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
    insertPhysicsFormulas: function () {
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
    insertChemistryFormulas: function () {
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
    insertFlowchart: function () {
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
    insertSequenceDiagram: function () {
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
    insertGanttChart: function () {
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
    insertPieChart: function () {
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
    insertCard: function () {
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
    insertEChartsTemplate: function () {
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
    imageInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
        // 清空输入，允许选择同一文件
        e.target.value = '';
    });

    // 剪贴板粘贴图片处理
    markdownInput.addEventListener('paste', function (e) {
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
        reader.onload = function (e) {
            resolve(e.target.result);
        };
        reader.onerror = function (error) {
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

    // 使用稳定短引用，完整图片数据保存在内存与 IndexedDB 中
    const randomId = window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    const imageReference = `madopic-image://${randomId}`;
    const imageMarkdown = `\n![${filename}](${imageReference})\n`;

    // 存储完整的图片数据供预览和导出使用
    storeImageData(imageReference, base64);

    // 插入到光标位置
    applyEditorChange(
        beforeText + imageMarkdown + afterText,
        cursorPos + imageMarkdown.length,
        cursorPos + imageMarkdown.length
    );
}

// 存储图片数据映射
function storeImageData(shortBase64, fullBase64) {
    imageDataStore.set(shortBase64, fullBase64);
    if (typeof indexedDB !== 'undefined') {
        ImagePersistence.save(shortBase64, fullBase64).catch((error) => {
            console.warn('图片持久化失败，将仅在当前页面保留:', error);
            if (!hasShownImagePersistenceWarning) {
                hasShownImagePersistenceWarning = true;
                showNotification('图片已插入，但浏览器无法持久保存；刷新后可能需要重新插入', 'warning');
            }
        });
    }
}

// 替换预览中的简化base64为完整base64
function replaceImageDataForPreview(content) {
    let result = content;
    imageDataStore.forEach((fullBase64, shortBase64) => {
        // 先跳过未引用的历史图片，避免为每张图片重复扫描并编译正则。
        if (result.includes(shortBase64)) {
            result = result.split(shortBase64).join(fullBase64);
        }
    });
    return result;
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
    // 四角均有内容时，任何边都不能裁剪，无需复制整张高清画布。
    if (width > 0 && height > 0 && [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]
        .every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] !== 0)) return null;
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

// ===== 撤销/重做快捷键 =====
document.addEventListener('keydown', (e) => {
    if (activeSettingsPanel || (e.target !== markdownInput && e.target?.matches('input, textarea, [contenteditable="true"]'))) return;
    // Ctrl+Z 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        // 先记录尚未进入 500ms 防抖历史的输入，保证立即撤销也能重做。
        undoRedoManager.push(markdownInput.value);
        const state = undoRedoManager.undo();
        if (state !== null && markdownInput) {
            undoRedoManager.isUndoRedo = true;
            markdownInput.value = state;
            undoRedoManager.isUndoRedo = false;
            updatePreview();
        }
    }
    // Ctrl+Y 或 Ctrl+Shift+Z 重做
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const state = undoRedoManager.redo();
        if (state !== null && markdownInput) {
            undoRedoManager.isUndoRedo = true;
            markdownInput.value = state;
            undoRedoManager.isUndoRedo = false;
            updatePreview();
        }
    }
});

// 保存输入状态到撤销栈（防抖）
const pushUndoState = debounce(() => {
    if (markdownInput) {
        undoRedoManager.push(markdownInput.value);
    }
}, 500);

// ===== 拖拽图片插入 =====
function setupDragDropImage() {
    if (!markdownInput) return;

    markdownInput.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        markdownInput.classList.add('drag-over');
    });

    markdownInput.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        markdownInput.classList.remove('drag-over');
    });

    markdownInput.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        markdownInput.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                await handleImageFile(file);
            }
        }
    });
}

// ===== 触屏双指缩放 =====
function setupPinchZoom() {
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) return;

    let initialDistance = 0;
    let initialZoom = 100;

    previewContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = currentZoom;
        }
    }, { passive: true });

    previewContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scale = currentDistance / initialDistance;
            let newZoom = Math.round(initialZoom * scale);
            newZoom = Math.max(25, Math.min(200, newZoom));
            if (newZoom !== currentZoom) {
                currentZoom = newZoom;
                const previewContent = document.querySelector('.preview-content');
                if (previewContent) {
                    previewContent.style.transform = `scale(${currentZoom / 100})`;
                }
                const zoomLevel = document.querySelector('.zoom-level');
                if (zoomLevel) {
                    zoomLevel.textContent = `${currentZoom}%`;
                }
            }
        }
    }, { passive: true });
}

// ===== 汉堡菜单（移动端响应式） =====
function setupHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const toolbarRight = document.getElementById('toolbarRight');
    if (!hamburgerBtn || !toolbarRight) return;
    const mobileViewport = window.matchMedia('(max-width: 900px)');
    const syncMenu = () => {
        const expanded = toolbarRight.classList.contains('mobile-open');
        const hidden = mobileViewport.matches && !expanded;
        hamburgerBtn.setAttribute('aria-expanded', String(expanded));
        toolbarRight.setAttribute('aria-hidden', String(hidden));
        toolbarRight.inert = hidden;
    };

    hamburgerBtn.addEventListener('click', () => {
        toolbarRight.classList.toggle('mobile-open');
        hamburgerBtn.classList.toggle('active');
        syncMenu();
    });

    // 点击菜单项后自动关闭
    toolbarRight.addEventListener('click', (e) => {
        if (e.target.closest('.btn')) {
            toolbarRight.classList.remove('mobile-open');
            hamburgerBtn.classList.remove('active');
            syncMenu();
        }
    });
    toolbarRight.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mobileViewport.matches) {
            toolbarRight.classList.remove('mobile-open');
            hamburgerBtn.classList.remove('active');
            hamburgerBtn.focus();
            syncMenu();
        }
    });
    mobileViewport.addEventListener('change', () => {
        toolbarRight.classList.remove('mobile-open');
        hamburgerBtn.classList.remove('active');
        syncMenu();
    });
    syncMenu();
}

// ===== 草稿恢复 =====
function restoreDraft() {
    const draft = loadDraft();
    const settings = loadSettings();
    let shouldRefreshPreview = false;

    if (draft !== null && markdownInput) {
        // 只有当草稿内容与默认内容不同时才恢复
        const defaultContent = markdownInput.value;
        if (draft !== defaultContent) {
            markdownInput.value = draft;
            undoRedoManager.push(draft);
            shouldRefreshPreview = true;
        }
    }

    // 恢复设置
    if (settings) {
        if (settings.background) {
            currentBackground = settings.background;
            if (backgroundPresets[currentBackground]) {
                applyBackground(backgroundPresets[currentBackground]);
            }
        }
        if (Number.isFinite(settings.fontSize)) {
            currentFontSize = Math.min(22, Math.max(14, settings.fontSize));
            const fontSizeSlider = document.getElementById('fontSizeSlider');
            const fontSizeValue = document.getElementById('fontSizeValue');
            if (fontSizeSlider) fontSizeSlider.value = currentFontSize;
            if (fontSizeValue) fontSizeValue.textContent = `${currentFontSize}px`;
            applyFontSize(currentFontSize);
            shouldRefreshPreview = true;
        }
        if (Number.isFinite(settings.padding)) {
            currentPadding = Math.min(60, Math.max(8, settings.padding));
            const paddingSlider = document.getElementById('paddingSlider');
            const paddingValue = document.getElementById('paddingValue');
            if (paddingSlider) paddingSlider.value = currentPadding;
            if (paddingValue) paddingValue.textContent = `${currentPadding}px`;
            applyPadding(currentPadding);
            shouldRefreshPreview = true;
        }
        if (Number.isFinite(settings.width)) {
            currentWidth = Math.min(800, Math.max(480, settings.width));
            const widthSlider = document.getElementById('widthSlider');
            const widthValue = document.getElementById('widthValue');
            if (widthSlider) widthSlider.value = currentWidth;
            if (widthValue) widthValue.textContent = `${currentWidth}px`;
            applyWidth(currentWidth);
            shouldRefreshPreview = true;
        }
        if (settings.mode && ['free', 'xhs', 'pyq'].includes(settings.mode)) {
            setMode(settings.mode);
            shouldRefreshPreview = true;
        }
    }

    if (shouldRefreshPreview) {
        updateLineNumbers();
        updatePreview();
    }
}

// ===== 初始化所有优化功能 =====
async function initOptimizations() {
    // 先恢复本地图片映射，避免草稿首次渲染出现失效的短引用
    try {
        const references = (loadDraft() || '').match(/madopic-image:\/\/[A-Za-z0-9_-]+/g) || [];
        await ImagePersistence.loadAll(references);
    } catch (error) {
        console.warn('本地图片存储不可用，将使用内存模式:', error);
    }

    // 恢复草稿
    restoreDraft();

    // 初始化撤销栈
    if (markdownInput) {
        undoRedoManager.push(markdownInput.value);

        // 监听输入事件，记录撤销状态
        markdownInput.addEventListener('input', () => {
            pushUndoState();
        });
    }

    // 设置拖拽图片
    setupDragDropImage();

    // 设置触屏缩放
    setupPinchZoom();

    // 设置汉堡菜单
    setupHamburgerMenu();

    console.log('Madopic 优化功能已初始化');
}
