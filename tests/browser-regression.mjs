import assert from 'node:assert/strict';

// Run through ego-browser with a Page pointing at the local HTTP preview.
export async function runBrowserRegression(page) {
  await page.cdp('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#toolbarRight').inert);
  const security = await page.evaluate(async () => {
    await updatePreview();
    const unsafe = '<style>body{opacity:0}</style><svg><a href="https://example.com"><animate attributeName="href" values="javascript:alert(1)"/></a></svg><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><iframe srcdoc="bad"></iframe><pre data-dependencies="../../extra-script"><code class="language-javascript">const safe = 1;</code></pre>';
    const node = document.createElement('div');
    node.innerHTML = sanitizeHTML(unsafe);
    const card = document.createElement('div');
    await cardRenderer.renderCard(card, '**safe**', 'info"><img src=x onerror=alert(1)>');
    const image = document.createElement('canvas');
    image.width = image.height = 1;
    imageDataStore.set('madopic-image://inside-card', image.toDataURL('image/png'));
    const imageCard = document.createElement('div');
    await cardRenderer.renderCard(imageCard, '![local](madopic-image://inside-card)', 'info');
    const config = JSON.parse('{"title":{"link":"javascript:alert(1)"},"tooltip":{"formatter":"<img src=x onerror=alert(1)>{b}"},"toolbox":{"feature":{"dataView":{"title":"<img src=x>","lang":["<script>bad</script>"]}}},"__proto__":{"polluted":true}}');
    sanitizeEChartsConfig(config);
    const purifier = window.DOMPurify;
    window.DOMPurify = undefined;
    const fallback = sanitizeHTML('<img src=x onerror=alert(1)>');
    window.DOMPurify = purifier;
    return {
      dangerousNodes: node.querySelectorAll('style, script, iframe, animate').length,
      dangerousAttrs: node.querySelectorAll('[onerror], [href^="javascript:"], [data-dependencies], [data-src], [data-jsonp]').length,
      cardInjection: card.querySelectorAll('img, [onerror]').length,
      cardText: card.textContent.trim(),
      cardImage: imageCard.querySelector('img')?.src.startsWith('data:image/png'),
      badLink: Object.hasOwn(config.title, 'link'),
      badPrototype: Object.hasOwn(config, '__proto__'),
      tooltip: config.tooltip.formatter,
      dataView: config.toolbox.feature.dataView.title,
      fallback,
    };
  });
  assert.equal(security.dangerousNodes, 0);
  assert.equal(security.dangerousAttrs, 0);
  assert.equal(security.cardInjection, 0);
  assert.equal(security.cardText, 'safe');
  assert.equal(security.cardImage, true, 'local image references must resolve inside cards');
  assert.equal(security.badLink, false);
  assert.equal(security.badPrototype, false);
  assert.ok(!security.tooltip.includes('onerror'));
  assert.match(security.dataView, /&lt;img/);
  assert.match(security.fallback, /^&lt;img/);

  const rendering = await page.evaluate(async () => {
    const chart = '```echarts\n' + JSON.stringify({animation: false, xAxis: {type: 'category', data: ['A', 'B']}, yAxis: {}, series: [{type: 'bar', data: [3, 5]}]}) + '\n```';
    markdownInput.value = '# 回归检查\n\n$E=mc^{2}$\n\n$\\ce{H2O}$\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n' + chart + '\n\n:::card info\n**卡片**\n:::\n\n```javascript\nconst value = 1;\n```';
    await updatePreview();
    const element = posterContent.querySelector('.echarts-container');
    const instance = echartsRenderer.instances.get(element);
    await updatePreview();
    const unchanged = echartsRenderer.instances.get(posterContent.querySelector('.echarts-container')).chart === instance.chart;
    const output = {
      math: posterContent.querySelectorAll('.katex').length,
      mathErrors: posterContent.querySelectorAll('.katex-error').length,
      diagrams: posterContent.querySelectorAll('.mermaid-diagram svg').length,
      charts: posterContent.querySelectorAll('.echarts-container canvas').length,
      cards: posterContent.querySelectorAll('.madopic-card').length,
      highlighted: posterContent.querySelectorAll('pre .token').length > 0,
      unchanged,
    };
    markdownInput.value += '\n最新内容';
    const clone = await createExactExportNode();
    output.exportIsLatest = clone.textContent.includes('最新内容');
    const exportChart = echartsRenderer.instances.get(clone.querySelector('.echarts-container')).chart;
    await replaceEChartsWithImages(clone);
    output.exportImage = !!clone.querySelector('.echarts-container img');
    output.exportChartDisposed = exportChart.isDisposed();
    const html = buildStandaloneHTML(clone, {});
    output.exportCSP = html.includes("script-src 'none'");
    removeExportNode(clone);
    output.oldChartDisposed = instance.chart.isDisposed();
    const current = echartsRenderer.instances.get(posterContent.querySelector('.echarts-container')).chart;
    markdownInput.value = '';
    await updatePreview();
    output.clearChartDisposed = current.isDisposed();
    return output;
  });
  assert.equal(rendering.math, 2);
  assert.equal(rendering.mathErrors, 0);
  assert.equal(rendering.diagrams, 1);
  assert.equal(rendering.charts, 1);
  assert.equal(rendering.cards, 1);
  for (const key of ['highlighted', 'unchanged', 'exportIsLatest', 'exportImage', 'exportChartDisposed', 'exportCSP', 'oldChartDisposed', 'clearChartDisposed']) assert.equal(rendering[key], true, key);

  const queue = await page.evaluate(async () => {
    const original = diagramRenderer.renderDiagrams;
    let active = 0, maxActive = 0;
    let signal;
    const started = new Promise(resolve => { signal = resolve; });
    diagramRenderer.renderDiagrams = async () => {
      active++;
      maxActive = Math.max(active, maxActive);
      signal();
      await new Promise(resolve => setTimeout(resolve, 20));
      active--;
    };
    try {
      markdownInput.value = '# First';
      const first = updatePreview();
      await started;
      markdownInput.value = '# Second';
      const second = updatePreview();
      markdownInput.value = '# Latest';
      const latest = updatePreview();
      await Promise.all([first, second, latest]);
      return {maxActive, text: posterContent.textContent.trim()};
    } finally { diagramRenderer.renderDiagrams = original; }
  });
  assert.equal(queue.maxActive, 1, 'render pipelines must not overlap');
  assert.equal(queue.text, 'Latest', 'the newest edit must win');

  const failures = await page.evaluate(async () => {
    const originalInit = echarts.init;
    let disposed = 0;
    echarts.init = () => ({setOption() { throw new Error('bad option'); }, dispose() { disposed++; }});
    try { await echartsRenderer.renderEChart(document.createElement('div'), '{}', 'failed-chart'); }
    finally { echarts.init = originalInit; }
    markdownInput.value = '<div class="mermaid-container" data-diagram-code="%"></div>\n\n<div class="echarts-container" data-echarts-config="%"></div>\n\n<div class="card-container" data-card-id="bad" data-card-content="%"></div>\n\n# Healthy content';
    await updatePreview();
    return {disposed, healthy: posterContent.textContent.includes('Healthy content'), errors: posterContent.querySelectorAll('.diagram-error, .echarts-error').length};
  });
  assert.equal(failures.disposed, 1, 'failed setOption must dispose its instance');
  assert.equal(failures.healthy, true, 'malformed metadata must not abort the rest of the preview');
  assert.equal(failures.errors, 2);

  // All shipped templates exercise the upgraded libraries with existing syntax.
  const templates = await page.evaluate(async () => {
    markdownInput.value = '';
    markdownInput.setSelectionRange(0, 0);
    for (const name of ['insertEinsteinFormula', 'insertMathFormulas', 'insertPhysicsFormulas', 'insertChemistryFormulas', 'insertFlowchart', 'insertSequenceDiagram', 'insertGanttChart', 'insertPieChart', 'insertEChartsTemplate', 'insertCard']) {
      if (typeof MarkdownHelper[name] !== 'function') throw new Error('Missing template: ' + name);
      MarkdownHelper[name]();
    }
    await updatePreview();
    return {
      formulas: posterContent.querySelectorAll('.katex').length,
      diagrams: posterContent.querySelectorAll('.mermaid-diagram svg').length,
      charts: posterContent.querySelectorAll('.echarts-container canvas').length,
      errors: [...posterContent.querySelectorAll('.katex-error, .diagram-error, .echarts-error')].map(el => el.textContent),
    };
  });
  assert.ok(templates.formulas > 20);
  assert.equal(templates.diagrams, 4);
  assert.equal(templates.charts, 2);
  assert.deepEqual(templates.errors, []);

  // Use actual keyboard input to verify focus confinement and restoration.
  await page.click('#layoutBtn');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fontSizeSlider');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'applyLayout');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fontSizeSlider');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'layoutBtn');
  assert.equal(await page.evaluate(() => layoutPanel.inert), true);
  await page.click('#backgroundBtn');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => currentBackground), 'gradient2');
  await page.keyboard.press('Escape');

  const ratios = await page.evaluate(() => {
    applyWidth(800);
    setMode('xhs');
    const xhs = markdownPoster.offsetHeight;
    setMode('pyq');
    const pyq = markdownPoster.offsetHeight;
    setMode('free');
    applyWidth(640);
    return {xhs, pyq};
  });
  assert.equal(ratios.xhs, 1067);
  assert.equal(ratios.pyq, 1734);

  // Mobile navigation must be exposed only when opened, and stay keyboard usable.
  await page.cdp('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await page.waitForFunction(() => document.querySelector('#toolbarRight').inert);
  await page.click('#hamburgerBtn');
  assert.equal(await page.evaluate(() => document.querySelector('#hamburgerBtn').getAttribute('aria-expanded')), 'true');
  await page.click('#layoutBtn');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'hamburgerBtn');
  await page.cdp('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await page.waitForFunction(() => !document.querySelector('#toolbarRight').inert);

  console.log('Browser regression passed: sanitization, templates, render queue, chart lifecycle, latest export, dialogs, keyboard presets, ratios, and mobile menu.');
}

export async function runZoomRegression(page) {
  await page.cdp('Emulation.setDeviceMetricsOverride', {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
  await page.evaluate(async () => {
    markdownInput.value = '# 缩放回归\n\n这段文字用于检查缩放前后海报布局、换行和导出尺寸是否保持一致。\n\n'.repeat(8);
    await updatePreview();
  });
  const pinch = await page.evaluate(() => {
    const target = document.getElementById('previewContainer');
    const dispatch = (type, distance) => target.dispatchEvent(new TouchEvent(type, {touches: [
      new Touch({identifier: 0, target, clientX: 0, clientY: 0}),
      new Touch({identifier: 1, target, clientX: distance, clientY: 0}),
    ]}));
    currentZoom = 100;
    applyZoom();
    dispatch('touchstart', 0);
    dispatch('touchmove', 145);
    const degenerate = currentZoom;
    dispatch('touchstart', 100);
    dispatch('touchmove', 145);
    return {degenerate, zoom: currentZoom, transform: previewContent.style.transform};
  });
  assert.equal(pinch.degenerate, 100, 'overlapping fingers must not divide by zero');
  assert.equal(pinch.zoom, 145);
  assert.equal(pinch.transform, 'scale(1.45)', 'pinch must use the same visible transform as buttons');
  for (const zoom of [25, 50, 75, 100, 125, 150, 175, 200]) {
    await page.evaluate(zoom => { currentZoom = zoom; applyZoom(); }, zoom);
    await page.waitForFunction(zoom => Math.abs(markdownPoster.getBoundingClientRect().width - markdownPoster.offsetWidth * zoom / 100) < 0.1, zoom);
    for (const width of [480, 640, 800]) {
      for (const mode of ['free', 'xhs', 'pyq']) {
        const dimensions = await page.evaluate(async ({width, mode}) => {
          applyWidth(width);
          setMode(mode);
          const clone = await createExactExportNode();
          try {
            const inner = clone.querySelector('.poster-content');
            return {
              width: markdownPoster.offsetWidth,
              height: markdownPoster.offsetHeight,
              cloneWidth: clone.offsetWidth,
              cloneHeight: clone.offsetHeight,
              innerWidth: posterContent.offsetWidth,
              cloneInnerWidth: inner.offsetWidth,
              innerHeight: posterContent.offsetHeight,
              cloneInnerHeight: inner.offsetHeight,
            };
          } finally { removeExportNode(clone); }
        }, {width, mode});
        assert.equal(dimensions.width, width);
        assert.equal(dimensions.cloneWidth, width, `${zoom}% zoom must preserve export width`);
        assert.equal(dimensions.cloneInnerWidth, dimensions.innerWidth, 'export must preserve text wrapping width');
        assert.equal(dimensions.cloneInnerHeight, dimensions.innerHeight, 'export must preserve content layout');
        assert.equal(dimensions.cloneHeight, dimensions.height);
        if (mode !== 'free') assert.equal(dimensions.height, Math.round(width * (mode === 'xhs' ? 4 / 3 : 2796 / 1290)));
      }
    }
  }
  await page.evaluate(() => { currentZoom = 100; applyZoom(); setMode('free'); applyWidth(640); });
  await page.click('#zoomOut');
  assert.equal(await page.evaluate(() => previewContent.style.transform), 'scale(0.75)', 'zoom buttons must change the actual transform');
  await page.click('#zoomIn');
  assert.equal(await page.evaluate(() => previewContent.style.transform), '', '100% must clear the pinch or button transform');
  console.log('Zoom regression passed: 25–200% display zoom, three widths and modes, export geometry and button controls.');
}

export async function runExportRegression(page, outputDirectory, zoom = 100) {
  const { readFile } = await import('node:fs/promises');
  await page.cdp('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await page.evaluate(async () => {
    setMode('free');
    currentBackground = 'gradient1';
    applyBackground(backgroundPresets.gradient1);
    const chart = {xAxis: {type: 'category', data: ['A', 'B']}, yAxis: {}, series: [{type: 'bar', data: [3, 5]}]};
    markdownInput.value = '# 导出回归检查\n\n中文文字与 English text\n\n$E=mc^{2}$\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n```echarts\n' + JSON.stringify(chart) + '\n```\n\n:::card info\n**信息卡片**\n:::';
    markdownInput.setSelectionRange(markdownInput.value.length, markdownInput.value.length);
    const image = document.createElement('canvas');
    image.width = 32;
    image.height = 32;
    image.getContext('2d').fillRect(0, 0, 32, 32);
    insertImageIntoMarkdown(image.toDataURL('image/png'), 'local.png');
    const reference = markdownInput.value.match(/madopic-image:\/\/[A-Za-z0-9_-]+/)[0];
    await ImagePersistence.save(reference, imageDataStore.get(reference));
    await updatePreview();
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#posterContent img')?.naturalWidth === 32);
  assert.equal(await page.evaluate(() => imageDataStore.size), 1, 'startup must load only the current draft images');
  await page.evaluate(zoom => { currentZoom = zoom; applyZoom(); }, zoom);

  const artifacts = [];
  for (const [extension, button] of [['png', '#exportPngBtn'], ['html', '#exportHtmlBtn'], ['pdf', '#exportPdfBtn']]) {
    const pending = page.waitForEvent('download', {timeout: 60000});
    await page.click(button);
    const download = await pending;
    assert.match(download.suggestedFilename(), new RegExp(`^madopic-\\d+\\.${extension}$`));
    const path = `${outputDirectory}/madopic-audit.${extension}`;
    await download.saveAs(path);
    const bytes = await readFile(path);
    assert.ok(bytes.length > 1000, `${extension} must contain an actual artifact`);
    if (extension === 'png') {
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.equal(bytes.readUInt32BE(16), 1280, 'PNG must preserve the 640px poster at 2x resolution');
    } else if (extension === 'html') {
      const html = bytes.toString('utf8');
      assert.ok(html.includes('导出回归检查'));
      assert.ok(html.includes("script-src 'none'"));
      assert.ok(html.includes('data:image/png;base64,'));
      assert.ok(html.includes('https://cdn.jsdelivr.net/npm/katex@0.18.2/dist/fonts/KaTeX_'));
    } else {
      assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
      const pdf = bytes.toString('latin1');
      assert.ok(pdf.includes('/FontFile2'), 'PDF must embed the editable Chinese font');
      assert.ok(pdf.includes('/ToUnicode'), 'PDF must preserve selectable Unicode text');
    }
    await page.waitForFunction(() => !exportInProgress);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#madopic-export-poster').length), 0, 'export clones must be removed');
    artifacts.push({extension, path, bytes: bytes.length});
  }
  console.log({exportsPassed: artifacts});
}
