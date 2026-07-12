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
      return { width: 640, height: 600, top: 0, left: 0, bottom: 600, right: 640 };
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
