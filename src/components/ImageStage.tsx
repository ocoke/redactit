import { useMemo, useRef, useState } from 'react';
import type { Box, Detection, OcrWord } from '../types';

type Props = {
  imageSrc: string;
  words: OcrWord[];
  detections: Detection[];
  onManualAdd: (box: Box) => void;
  onToggleDetection: (id: string) => void;
};

export function ImageStage({ imageSrc, words, detections, onManualAdd, onToggleDetection }: Props) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const activeBoxes = useMemo(() => {
    const byWord = new Map<number, OcrWord>();
    words.forEach((w, idx) => byWord.set(idx, w));
    return detections
      .filter((d) => d.active)
      .flatMap((d) => d.wordIndices.map((idx) => byWord.get(idx)?.box).filter(Boolean)) as Box[];
  }, [words, detections]);

  const drawingBox = dragStart && dragEnd
    ? {
        x: Math.min(dragStart.x, dragEnd.x),
        y: Math.min(dragStart.y, dragEnd.y),
        w: Math.abs(dragStart.x - dragEnd.x),
        h: Math.abs(dragStart.y - dragEnd.y)
      }
    : null;

  const toImageCoords = (evt: React.MouseEvent) => {
    const img = imgRef.current;
    if (!img) return null;
    const r = img.getBoundingClientRect();
    const x = ((evt.clientX - r.left) / r.width) * img.naturalWidth;
    const y = ((evt.clientY - r.top) / r.height) * img.naturalHeight;
    return { x, y };
  };

  return (
    <div>
      <div
        style={{ position: 'relative', display: 'inline-block', border: '1px solid #ddd' }}
        onMouseDown={(e) => {
          const p = toImageCoords(e);
          if (!p) return;
          setDragStart(p);
          setDragEnd(p);
        }}
        onMouseMove={(e) => {
          if (!dragStart) return;
          const p = toImageCoords(e);
          if (!p) return;
          setDragEnd(p);
        }}
        onMouseUp={() => {
          if (drawingBox && drawingBox.w > 5 && drawingBox.h > 5) {
            onManualAdd(drawingBox);
          }
          setDragStart(null);
          setDragEnd(null);
        }}
      >
        <img ref={imgRef} src={imageSrc} alt="uploaded" style={{ maxWidth: '100%', display: 'block' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${imgRef.current?.naturalWidth || 1000} ${imgRef.current?.naturalHeight || 1000}`}>
          {activeBoxes.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="rgba(0,0,0,0.82)" stroke="rgba(255,255,255,0.5)" />
          ))}
          {drawingBox && <rect x={drawingBox.x} y={drawingBox.y} width={drawingBox.w} height={drawingBox.h} fill="rgba(255,0,0,0.2)" stroke="red" />}
        </svg>
      </div>

      <h4>Detections</h4>
      <ul style={{ maxHeight: 200, overflow: 'auto', paddingLeft: 20 }}>
        {detections.map((d) => (
          <li key={d.id}>
            <label>
              <input type="checkbox" checked={d.active} onChange={() => onToggleDetection(d.id)} /> {d.type}: <code>{d.sourceText}</code> ({d.reason})
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
