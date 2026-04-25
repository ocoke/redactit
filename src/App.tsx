import { useMemo, useState } from 'react';
import { ImageStage } from './components/ImageStage';
import { detectSensitive } from './lib/detection';
import { exportRedactedPng } from './lib/export';
import { assignRoles, buildContext, detectScreenType, groupIntoLines } from './lib/layout';
import { runOcr } from './lib/ocr';
import type { Box, Detection, Mode, OcrLine, OcrWord, RoleAssignment, ScreenType } from './types';

export default function App() {
  const [mode, setMode] = useState<Mode>('strict');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [words, setWords] = useState<OcrWord[]>([]);
  const [lines, setLines] = useState<OcrLine[]>([]);
  const [screenType, setScreenType] = useState<ScreenType>('unknown');
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [contextText, setContextText] = useState<string>('');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const activeBoxes = useMemo(() => {
    return detections
      .filter((d) => d.active)
      .flatMap((d) => d.wordIndices.map((idx) => words[idx]?.box).filter(Boolean)) as Box[];
  }, [detections, words]);

  const handleUpload = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      const src = await fileToDataUrl(file);
      setImageSrc(src);

      const img = await loadImage(src);
      const ocrWords = await runOcr(src);
      const ocrLines = groupIntoLines(ocrWords);
      const type = detectScreenType(ocrLines);
      const roleAssignments = assignRoles(ocrWords, ocrLines, type, img.width);
      const context = buildContext(ocrLines, type, roleAssignments, ocrWords);
      const found = detectSensitive(ocrWords, roleAssignments, mode);

      setWords(ocrWords);
      setLines(ocrLines);
      setScreenType(type);
      setRoles(roleAssignments);
      setContextText(context);
      setDetections(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process screenshot');
    } finally {
      setBusy(false);
    }
  };

  const toggleDetection = (id: string) => {
    setDetections((curr) => curr.map((d) => (d.id === id ? { ...d, active: !d.active } : d)));
  };

  const addManual = (box: Box) => {
    setDetections((curr) => [
      ...curr,
      {
        id: `manual-${crypto.randomUUID()}`,
        sourceText: '[manual] ',
        type: 'generic_sensitive',
        reason: 'manual redaction',
        score: 1,
        wordIndices: [registerManualWord(box)],
        active: true
      }
    ]);
  };

  const registerManualWord = (box: Box): number => {
    const idx = words.length;
    setWords((curr) => [...curr, { text: '[manual]', confidence: 100, box }]);
    return idx;
  };

  const redactAllSimilar = (text: string) => {
    if (!text) return;
    const target = text.toLowerCase();
    const indices = words.map((w, idx) => ({ w, idx })).filter(({ w }) => w.text.toLowerCase() === target).map(({ idx }) => idx);
    if (indices.length === 0) return;
    setDetections((curr) => [
      ...curr,
      {
        id: `similar-${target}-${crypto.randomUUID()}`,
        sourceText: text,
        type: 'generic_sensitive',
        reason: 'manual: redact all similar text',
        score: 1,
        wordIndices: indices,
        active: true
      }
    ]);
  };

  const exportImage = async () => {
    if (!imageSrc) return;
    const out = await exportRedactedPng(imageSrc, activeBoxes);
    const a = document.createElement('a');
    a.href = out;
    a.download = 'redacted.png';
    a.click();
  };

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>RedactIt</h1>
      <p>Local-first screenshot redactor with OCR + context reconstruction. No backend upload.</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <label>
          Upload screenshot:{' '}
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </label>

        <label>
          Mode:{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="strict">Strict</option>
            <option value="balanced">Balanced</option>
          </select>
        </label>

        <button onClick={exportImage} disabled={!imageSrc}>Export redacted PNG</button>
      </div>

      {busy && <p>Running local OCR + detection…</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {imageSrc && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <ImageStage
            imageSrc={imageSrc}
            words={words}
            detections={detections}
            onManualAdd={addManual}
            onToggleDetection={toggleDetection}
          />

          <aside style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
            <h3>Analysis</h3>
            <p><strong>Screen type:</strong> {screenType}</p>
            <p><strong>OCR words:</strong> {words.length}</p>
            <p><strong>Lines:</strong> {lines.length}</p>
            <p><strong>Roles:</strong> {roles.length}</p>

            <h4>Reconstructed context</h4>
            <textarea value={contextText} readOnly rows={12} style={{ width: '100%' }} />

            <h4>Actions</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                const value = prompt('Text to redact everywhere (exact match):');
                if (value) redactAllSimilar(value);
              }}>Redact all similar text</button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
