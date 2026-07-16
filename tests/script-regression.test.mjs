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
  /await\s+ImagePersistence\.loadAll\(\)[\s\S]*?restoreDraft\(\)/,
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
