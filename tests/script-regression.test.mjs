import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'script.js'), 'utf8');

function createElement(overrides = {}) {
  const attributes = new Map();
  return {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    scrollHeight: 0,
    scrollTop: 0,
    dataset: {},
    style: {
      setProperty() {},
    },
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    addEventListener() {},
    removeEventListener() {},
    append() {},
    appendChild() {},
    removeChild() {},
    remove() {},
    focus() {},
    click() {},
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    get offsetWidth() { return Number.parseFloat(this.style.width) || 640; },
    getBoundingClientRect() {
      const width = Number.parseFloat(this.style.width) || 640;
      const height = Number.parseFloat(this.style.height) || 600;
      return { width, height, top: 0, left: 0, bottom: height, right: width };
    },
    cloneNode() { return createElement(); },
    ...overrides,
  };
}

const elements = new Map();
const getElement = (id) => {
  if (!elements.has(id)) elements.set(id, createElement({ id }));
  return elements.get(id);
};

const documentStub = {
  readyState: 'loading',
  body: createElement(),
  documentElement: createElement(),
  addEventListener() {},
  querySelector() { return createElement(); },
  querySelectorAll() { return []; },
  getElementById: getElement,
  createElement() { return createElement(); },
};

const windowStub = {
  location: {
    href: 'https://madopic.test/',
    origin: 'https://madopic.test',
    search: '',
  },
  devicePixelRatio: 1,
  addEventListener() {},
};

const context = vm.createContext({
  console: { log() {}, warn() {}, error() {} },
  document: documentStub,
  window: windowStub,
  localStorage: { getItem() { return null; }, setItem() {} },
  getComputedStyle() {
    return {
      padding: '0px',
      paddingTop: '0px',
      paddingBottom: '0px',
      background: '',
      backdropFilter: 'none',
      webkitBackdropFilter: 'none',
    };
  },
  requestAnimationFrame(callback) { callback(); },
  cancelAnimationFrame() {},
  setTimeout,
  clearTimeout,
  URL,
  URLSearchParams,
  Map,
  Set,
  WeakMap,
  Promise,
  Math,
  Date,
  JSON,
  RegExp,
  String,
  Number,
  Array,
  Object,
  Error,
  TypeError,
  encodeURIComponent,
  decodeURIComponent,
});

vm.runInContext(source, context, { filename: 'script.js' });
const run = (code) => vm.runInContext(code, context);

assert.equal(
  run('backgroundPresets.gradient1'),
  'linear-gradient(135deg, #A755F7 0%, #7275F2 50%, #6C23AA 100%)',
  'the default purple gradient must preserve the reference image color progression',
);

assert.equal(
  run('mathRenderer.preprocessMath("$F = ma$")'),
  '$F = ma$',
  'existing inline math must remain inline',
);

assert.equal(
  run('mathRenderer.preprocessMath("```js\\nconst π = 3;\\n```")'),
  '```js\nconst π = 3;\n```',
  'fenced code must not be rewritten by math shortcuts',
);

assert.equal(
  run('mathRenderer.preprocessMath("公式 F = ma")'),
  '公式 $F=ma$',
  'plain-text formula shortcuts must remain supported',
);

run(`
  updatePreview = () => Promise.resolve();
  updateLineNumbers = () => {};
  undoRedoManager.history = [];
  undoRedoManager.index = -1;
  markdownInput.value = '清空前的内容';
  undoRedoManager.push(markdownInput.value);
  handleToolbarAction('clear');
`);
assert.equal(run('markdownInput.value'), '', 'clear must still empty the editor');
assert.equal(
  run('undoRedoManager.undo()'),
  '清空前的内容',
  'undo after clear must restore the immediately previous content',
);

run(`
  undoRedoManager.history = [];
  undoRedoManager.index = -1;
  markdownInput.value = 'plain';
  markdownInput.selectionStart = 0;
  markdownInput.selectionEnd = 5;
  undoRedoManager.push(markdownInput.value);
  handleToolbarAction('bold');
`);
assert.equal(run('markdownInput.value'), '**plain**', 'toolbar formatting must keep its current output');
assert.equal(
  run('undoRedoManager.undo()'),
  'plain',
  'undo after toolbar formatting must restore the immediately previous content',
);

run(`
  undoRedoManager.history = [];
  undoRedoManager.index = -1;
  undoRedoManager.push('same');
  undoRedoManager.push('same');
`);
assert.equal(
  run('undoRedoManager.history.length'),
  1,
  'adjacent duplicate states must not create no-op undo steps',
);

const imageDataUrl = 'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
run(`
  undoRedoManager.history = [];
  undoRedoManager.index = -1;
  markdownInput.value = '';
  markdownInput.selectionStart = 0;
  markdownInput.selectionEnd = 0;
  insertImageIntoMarkdown(${JSON.stringify(imageDataUrl)}, 'example.png');
`);
const imageMarkdown = run('markdownInput.value');
assert.match(
  imageMarkdown,
  /madopic-image:\/\/[A-Za-z0-9_-]+/,
  'local images must use a stable draft-safe reference',
);
assert.equal(
  run(`replaceImageDataForPreview(${JSON.stringify(imageMarkdown)})`).includes(imageDataUrl),
  true,
  'stable local-image references must resolve from the in-memory store',
);
assert.match(source, /const ImagePersistence\s*=\s*\{/, 'an IndexedDB persistence adapter must exist');
assert.match(
  source,
  /await\s+ImagePersistence\.loadAll\(references\)[\s\S]*?restoreDraft\(\)/,
  'persisted images must load before the draft is restored',
);

run(`
  currentMode = 'xhs';
  markdownPoster.style.height = '';
  applyWidth(800);
`);
assert.equal(
  run('markdownPoster.style.height'),
  '1067px',
  'XHS height must be recalculated after width changes',
);

run(`
  currentMode = 'pyq';
  markdownPoster.style.height = '';
  applyWidth(800);
`);
assert.equal(
  run('markdownPoster.style.height'),
  '1734px',
  'PYQ height must be recalculated after width changes',
);

run(`markdownPoster.getBoundingClientRect = () => { throw new Error('Visual zoom must not size the poster'); };`);
for (const zoom of [25, 50, 75, 100, 125, 150, 175, 200]) {
  run(`currentZoom = ${zoom}; applyZoom();`);
  assert.equal(run('previewContent.style.transform'), zoom === 100 ? '' : `scale(${zoom / 100})`);
  assert.equal(run('zoomLevel.textContent'), `${zoom}%`);
  for (const [mode, ratio] of [['xhs', 4 / 3], ['pyq', 2796 / 1290]]) {
    for (const width of [480, 640, 800]) {
      run(`currentMode = '${mode}'; applyWidth(${width});`);
      assert.equal(run('markdownPoster.style.height'), `${Math.round(width * ratio)}px`, 'zoom must not change fixed poster ratios');
    }
  }
}
run('currentZoom = 145; zoomIn();');
assert.equal(run('currentZoom'), 150, 'button zoom after a pinch must respect its upper limit');
run('currentZoom = 60; zoomOut();');
assert.equal(run('currentZoom'), 50, 'button zoom after a pinch must respect its lower limit');
run("currentZoom = 100; applyZoom(); currentMode = 'free'; applyWidth(640);");

for (const url of ['javascript:alert(1)', 'java\nscript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,bad']) {
  assert.equal(run(`isSafeUrl(${JSON.stringify(url)})`), false, `${url} must not be a clickable URL`);
}
for (const url of ['https://example.com', '/docs', '#section', 'mailto:hello@example.com']) {
  assert.equal(run(`isSafeUrl(${JSON.stringify(url)})`), true, `${url} must remain supported`);
}
assert.equal(run('isSafeUrl("data:image/png;base64,AAAA", "image")'), true);
assert.equal(run('isSafeUrl("data:text/html,bad", "image")'), false);
assert.equal(
  run('sanitizeHTML("<img src=x onerror=alert(1)>")'),
  '&lt;img src=x onerror=alert(1)&gt;',
  'missing sanitizer must fall back to escaped text',
);

context.localStorage.getItem = (key) => key === 'madopic_draft' ? '' : null;
run(`markdownInput.value = 'Default content'; restoreDraft();`);
assert.equal(run('markdownInput.value'), '', 'a saved empty draft must survive refresh');

context.localStorage.getItem = (key) => key === 'madopic_settings'
  ? JSON.stringify({fontSize: 1e100, padding: -1e100, width: 1e100}) : null;
run('restoreDraft()');
assert.equal(run('currentFontSize'), 22);
assert.equal(run('currentPadding'), 8);
assert.equal(run('currentWidth'), 800, 'corrupt settings must not request unbounded export dimensions');

const appendedScripts = [];
documentStub.head = { appendChild(script) { appendedScripts.push(script); } };
const firstLoad = run('loadScript("https://example.com/test.js")');
const secondLoad = run('loadScript("https://example.com/test.js")');
assert.equal(appendedScripts.length, 1, 'concurrent library requests must share one script tag');
appendedScripts[0].onload();
await Promise.all([firstLoad, secondLoad]);
await run('loadScript("https://example.com/test.js")');
assert.equal(appendedScripts.length, 1, 'loaded libraries must not be downloaded again');

const failedLoad = run('loadScript("https://example.com/retry.js")');
appendedScripts[1].onerror();
await assert.rejects(failedLoad, /Unable to load script/);
const retryLoad = run('loadScript("https://example.com/retry.js")');
assert.equal(appendedScripts.length, 3, 'failed library loads must be retryable');
appendedScripts[2].onload();
await retryLoad;

context.cornerReads = [];
const opaqueResult = run(`trimTransparentEdges({
  width: 4000, height: 6000,
  getContext() {
    return { getImageData(x, y, width, height) {
      cornerReads.push({ x, y, width, height });
      return { data: [0, 0, 0, 255] };
    } };
  }
})`);
assert.equal(opaqueResult, null, 'opaque poster edges must remain intact');
assert.equal(context.cornerReads.length, 4);
assert.ok(context.cornerReads.every(read => read.width === 1 && read.height === 1), 'opaque posters must not allocate a full RGBA pixel buffer');
