import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import songbot from '../src/features/mediaAssistant/songbot.ts';

const engine = readFileSync(resolve('node_modules/wobnimo/dist/index.js'));
const server = createServer((request, response) => {
  if (request.url === '/wobnimo.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    response.end(engine);
  } else if (request.url === '/spec.json') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(songbot));
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Songbot render</title>');
  }
});

await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const encoded = await page.evaluate(async () => {
    const { snapshot } = await import('/wobnimo.js');
    const spec = await fetch('/spec.json').then((result) => result.json());
    const figure = await snapshot(spec, { state: 'idle', size: 488, pixelRatio: 1, seed: 0.3, turn: 0.18, settle: 1.5 });
    const face = await snapshot({ ...spec, frame: { target: 1.01, radius: 0.7 } },
      { state: 'idle', size: 256, pixelRatio: 1, seed: 0.3, turn: 0, settle: 1.5 });
    const states = ['idle', 'listening', 'thinking', 'working', 'speaking', 'celebrating', 'error', 'sleeping'];
    const strips = {};
    const frameSize = 144;
    const frameCount = 24;
    for (const state of states) {
      const strip = document.createElement('canvas');
      strip.width = frameSize * (frameCount + 1);
      strip.height = frameSize;
      const context = strip.getContext('2d');
      const frames = new Set();
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        const frame = await snapshot(spec, {
          state, size: frameSize, pixelRatio: 1, seed: 0.3, turn: 0.18,
          settle: 0.4 + frameIndex * 0.1
        });
        context.drawImage(frame, frameIndex * frameSize, 0);
        frames.add(frame.toDataURL());
        if (frameIndex === 0) context.drawImage(frame, frameCount * frameSize, 0);
      }
      strips[state] = { data: strip.toDataURL('image/webp', 0.88).split(',')[1], uniqueFrames: frames.size };
    }
    return {
      figure: figure.toDataURL('image/webp', 0.92).split(',')[1],
      face: face.toDataURL('image/webp', 0.92).split(',')[1],
      strips
    };
  });
  writeFileSync(resolve('public/assistantSongbot.webp'), Buffer.from(encoded.figure, 'base64'));
  writeFileSync(resolve('public/assistantSongbotFace.webp'), Buffer.from(encoded.face, 'base64'));
  for (const [state, strip] of Object.entries(encoded.strips)) {
    writeFileSync(resolve(`public/assistantSongbot${state[0].toUpperCase()}${state.slice(1)}.webp`), Buffer.from(strip.data, 'base64'));
    console.log(`${state}: ${strip.uniqueFrames} distinct frames`);
  }
} finally {
  await browser.close();
  server.close();
}
