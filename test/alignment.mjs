import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';

const browserName = process.env.INK_TEST_BROWSER || 'chrome';
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({
    browser: browserName,
    headless: true,
    ...(browserName === 'firefox' ? {
      ...(process.env.INK_FIREFOX_BIN ? { executablePath: process.env.INK_FIREFOX_BIN } : {})
    } : { args: ['--no-sandbox'] })
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/demo/index.html`);
  await page.waitForFunction(() => window.Reveal?.isReady() && document.querySelector('.present > .reveal-ink-surface'));
  assert.equal(await page.$eval('[data-tool="navigate"]', el => el.getAttribute('aria-pressed')), 'true');
  await page.click('[data-tool="pen"]');

  async function aligned(label) {
    // Compare the actual SVG-to-screen transform with the input coordinate system.
    // Loading the plugin or saving a stroke alone cannot detect a visible offset.
    await page.waitForFunction(() => {
      const svg = document.querySelector('.present > .reveal-ink-surface');
      if (!svg?.inkRect) return false;
      const m = svg.getScreenCTM(), r = svg.inkRect;
      const surface = svg.getBoundingClientRect(), root = document.querySelector('.reveal').getBoundingClientRect();
      return Math.abs(m.e-r.left) < 1 && Math.abs(m.f-r.top) < 1 && Math.abs(m.a-r.width/960) < 0.001 &&
        Math.abs(surface.width-root.width) < 1 && Math.abs(surface.height-root.height) < 1;
    });
    console.log(`PASS ${browserName}: ${label}`);
  }
  async function draw() {
    const pointer = await page.evaluate(() => {
      const root = document.querySelector('.reveal').getBoundingClientRect();
      return { x: root.left+root.width*0.6, y: root.top+root.height*0.6 };
    });
    await page.mouse.move(pointer.x-25, pointer.y);
    await page.mouse.down();
    await page.mouse.move(pointer.x+25, pointer.y, { steps: 8 });
    await page.mouse.up();
    const rendered = await page.$eval('.present > .reveal-ink-surface path:last-child', path => {
      const r = path.getBoundingClientRect();
      return { x: r.left+r.width/2, y: r.top+r.height/2 };
    });
    assert.ok(Math.abs(rendered.x-pointer.x) < 3 && Math.abs(rendered.y-pointer.y) < 3,
      `Rendered stroke ${JSON.stringify(rendered)} must match pointer ${JSON.stringify(pointer)}`);
  }
  async function slide(h, v=0) {
    await page.evaluate(({h,v}) => new Promise(resolve => {
      const done = () => { Reveal.off('slidetransitionend', done); resolve(); };
      Reveal.on('slidetransitionend', done);
      Reveal.slide(h,v);
      setTimeout(done, 1000);
    }), {h,v});
    await aligned(`slide ${h}/${v} after transition`);
  }

  await aligned('initial centered slide');
  await draw();
  const saved = await page.evaluate(() => Reveal.getPlugin('ink').exportJSON());
  const reflow = await page.evaluate(() => {
    const slide = Reveal.getCurrentSlide(), top = slide.style.top, scale = Reveal.getScale();
    slide.querySelector('.writing-space').style.height = '20px';
    Reveal.layout(); Reveal.layout();
    return { changed: top !== slide.style.top, sameScale: scale === Reveal.getScale() };
  });
  assert.ok(reflow.changed && reflow.sameScale, 'Exercise recentering without a resize event');
  await aligned('late layout with unchanged scale');
  assert.equal(await page.evaluate(() => Reveal.getPlugin('ink').exportJSON()), saved);

  await slide(1);
  assert.equal(await page.$$eval('.present > .reveal-ink-surface path', paths => paths.length), 0);
  await draw();
  await slide(2,0); await draw();
  await slide(2,1); await draw();
  await slide(0);
  assert.equal(await page.$$eval('.present > .reveal-ink-surface path', paths => paths.length), 1);
  await page.setViewport({ width: 768, height: 1024 });
  await aligned('portrait resize'); await draw();
  await page.setViewport({ width: 1440, height: 900 });
  await aligned('landscape resize');

  await page.evaluate(() => { Reveal.getPlugin('ink').toggleCanvas(); Reveal.getPlugin('ink').scrollCanvas(2); });
  await aligned('scrolled extra canvas'); await draw();
  await page.evaluate(() => Reveal.getPlugin('ink').toggleCanvas());
  await aligned('return from canvas');

  await slide(1);
  await page.evaluate(() => {
    const slide = Reveal.getCurrentSlide();
    slide.setAttribute('data-flashcards', '');
    slide.querySelector('.writing-space').style.height = '350px';
    Reveal.layout();
  });
  await aligned('dynamic flashcard layout'); await draw();
  await page.evaluate(() => Reveal.getPlugin('ink').destroy());
  assert.equal(await page.$('.reveal-ink-surface'), null);
} finally {
  await browser?.close();
  await server.close();
}
