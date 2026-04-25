import { createWorker } from 'tesseract.js';
import type { OcrWord } from '../types';

export async function runOcr(image: string): Promise<OcrWord[]> {
  const worker = await createWorker('eng');
  const result = await worker.recognize(image);

  const words: OcrWord[] = result.data.words
    .filter((w) => Boolean(w.text?.trim()))
    .map((w) => ({
      text: w.text.trim(),
      confidence: w.confidence,
      box: {
        x: w.bbox.x0,
        y: w.bbox.y0,
        w: Math.max(1, w.bbox.x1 - w.bbox.x0),
        h: Math.max(1, w.bbox.y1 - w.bbox.y0)
      }
    }));

  await worker.terminate();
  return words;
}
