// The heavy half: parse, signals, change points, bootstrap. A 40k message export takes about
// 700 ms of solid CPU, which would visibly freeze the page if it ran on the main thread.
//
// The chat text arrives here and the only thing that goes back is the verdict, a few kilobytes of
// counts and dates. Nothing is ever posted to a network from this file; there is no fetch in it.

import { analyzeTime } from './analyze.js';

self.onmessage = async (e) => {
  const { id, text } = e.data || {};
  try {
    if (!text || text.length < 40) throw new Error('sohbet çok kısa');
    const result = analyzeTime(text, {
      onProgress: (pct, note) => self.postMessage({ id, type: 'progress', pct, note }),
    });
    self.postMessage({ id, type: 'done', result, bytes: text.length });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String((err && err.message) || err) });
  }
};
