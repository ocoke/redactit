import type { Detection, Mode, OcrWord, RoleAssignment } from '../types';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const URL = /https?:\/\/[^\s]+|www\.[^\s]+/i;
const ACCOUNT = /\b\d{8,16}\b/;
const SECRET = /(?:api[_-]?key|token|secret|password|sk-[a-z0-9]{10,})/i;

export function detectSensitive(
  words: OcrWord[],
  roles: RoleAssignment[],
  mode: Mode
): Detection[] {
  const out: Detection[] = [];

  words.forEach((word, idx) => {
    const role = roles[idx]?.role ?? 'generic';
    const text = word.text;

    let detection: Omit<Detection, 'id' | 'active' | 'wordIndices'> | null = null;

    if (EMAIL.test(text)) {
      detection = { sourceText: text, type: 'email', reason: 'regex: email', score: 0.98 };
    } else if (PHONE.test(text)) {
      detection = { sourceText: text, type: 'phone', reason: 'regex: phone', score: 0.95 };
    } else if (URL.test(text)) {
      detection = { sourceText: text, type: 'url', reason: 'regex: url', score: 0.9 };
    } else if (SECRET.test(text)) {
      detection = { sourceText: text, type: 'secret', reason: 'regex/heuristic: secret pattern', score: 0.99 };
    } else if (ACCOUNT.test(text)) {
      detection = { sourceText: text, type: 'account_number', reason: 'regex: long number', score: 0.88 };
    } else if (text.startsWith('@')) {
      detection = { sourceText: text, type: 'username', reason: 'heuristic: handle', score: 0.84 };
    } else if (role === 'chat_header_contact' || role === 'email_sender' || role === 'form_value') {
      detection = { sourceText: text, type: 'private_person', reason: `heuristic role: ${role}`, score: 0.75 };
    }

    if (!detection) return;

    const threshold = mode === 'strict' ? 0.7 : 0.82;
    if (detection.score < threshold) return;

    out.push({
      ...detection,
      id: `${idx}-${detection.type}-${text}`,
      wordIndices: [idx],
      active: true
    });
  });

  return dedupeDetections(out);
}

function dedupeDetections(items: Detection[]): Detection[] {
  const map = new Map<string, Detection>();
  for (const d of items) {
    const key = `${d.type}:${d.sourceText.toLowerCase()}`;
    if (!map.has(key) || (map.get(key)?.score ?? 0) < d.score) {
      map.set(key, d);
    }
  }
  return [...map.values()];
}
