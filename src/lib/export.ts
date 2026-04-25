import type { Box } from '../types';

export async function exportRedactedPng(imageSrc: string, boxes: Box[]): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000';
  boxes.forEach((b) => {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  });

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
