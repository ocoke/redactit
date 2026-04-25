import type { OcrLine, OcrWord, RoleAssignment, ScreenType } from '../types';

const KEYWORDS = {
  email: ['from:', 'to:', 'subject:', 'inbox', 'sent'],
  form: ['name:', 'email:', 'phone:', 'address:', 'submit'],
  social: ['@', 'followers', 'following', 'bio'],
  code: ['error', 'warning', 'traceback', 'api_key', 'token', 'const', 'function'],
  chat: ['today', 'yesterday', 'am', 'pm', 'typing', 'message']
};

export function groupIntoLines(words: OcrWord[]): OcrLine[] {
  const sorted = [...words].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const lines: OcrLine[] = [];
  const tolerance = 14;

  for (const word of sorted) {
    const line = lines.find((l) => Math.abs(l.box.y - word.box.y) <= tolerance);

    if (!line) {
      lines.push({ text: word.text, box: { ...word.box }, words: [word] });
      continue;
    }

    line.words.push(word);
    line.words.sort((a, b) => a.box.x - b.box.x);
    line.text = line.words.map((w) => w.text).join(' ');

    const minX = Math.min(line.box.x, word.box.x);
    const minY = Math.min(line.box.y, word.box.y);
    const maxX = Math.max(line.box.x + line.box.w, word.box.x + word.box.w);
    const maxY = Math.max(line.box.y + line.box.h, word.box.y + word.box.h);
    line.box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  return lines.sort((a, b) => a.box.y - b.box.y);
}

export function detectScreenType(lines: OcrLine[]): ScreenType {
  const text = lines.map((l) => l.text.toLowerCase()).join('\n');
  const counts = {
    email: countHits(text, KEYWORDS.email),
    form: countHits(text, KEYWORDS.form),
    social: countHits(text, KEYWORDS.social),
    code: countHits(text, KEYWORDS.code),
    chat: countHits(text, KEYWORDS.chat)
  };

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] === 0) {
    return lines.length > 20 ? 'document' : 'unknown';
  }

  const [kind] = top;
  if (kind === 'email' || kind === 'form' || kind === 'social' || kind === 'code' || kind === 'chat') {
    return kind;
  }

  return 'unknown';
}

export function assignRoles(words: OcrWord[], lines: OcrLine[], screenType: ScreenType, imageWidth: number): RoleAssignment[] {
  const roles: RoleAssignment[] = [];

  words.forEach((word, idx) => {
    const lower = word.text.toLowerCase();
    let role: RoleAssignment['role'] = 'generic';

    if ((lower.includes('api_key') || lower.includes('token') || /sk-[a-z0-9]/i.test(lower))) {
      role = 'secret_candidate';
    } else if (lower.startsWith('@')) {
      role = 'username';
    } else if (/^\d{1,2}:\d{2}$/.test(lower) || lower === 'am' || lower === 'pm') {
      role = 'timestamp';
    }

    if (screenType === 'chat' && word.box.y < 110) {
      const center = word.box.x + word.box.w / 2;
      if (Math.abs(center - imageWidth / 2) < imageWidth * 0.2) {
        role = 'chat_header_contact';
      }
    }

    if (screenType === 'email') {
      const lineText = lineContaining(lines, word).toLowerCase();
      if (lineText.includes('from:')) role = 'email_sender';
      if (lineText.includes('to:')) role = 'email_recipient';
    }

    if (screenType === 'form') {
      const lineText = lineContaining(lines, word).toLowerCase();
      if (lineText.includes('name:') || lineText.includes('email:') || lineText.includes('phone:')) {
        role = 'form_value';
      }
    }

    if (role === 'generic' && screenType === 'chat') role = 'message_body';

    roles.push({ wordIndex: idx, role });
  });

  return roles;
}

export function buildContext(lines: OcrLine[], screenType: ScreenType, roles: RoleAssignment[], words: OcrWord[]): string {
  const roleByWord = new Map(roles.map((r) => [r.wordIndex, r.role]));
  const summary = lines
    .slice(0, 100)
    .map((line) => {
      const tags = line.words
        .map((w) => {
          const idx = words.indexOf(w);
          return idx >= 0 ? roleByWord.get(idx) : 'generic';
        })
        .filter(Boolean)
        .slice(0, 1);

      const tag = tags[0] ?? 'generic';
      return `${tag}: ${line.text}`;
    })
    .join('\n');

  return `Screen type: ${screenType}.\n${summary}`;
}

function lineContaining(lines: OcrLine[], word: OcrWord): string {
  const line = lines.find((l) => l.words.includes(word));
  return line?.text ?? word.text;
}

function countHits(text: string, kws: string[]): number {
  return kws.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
}
