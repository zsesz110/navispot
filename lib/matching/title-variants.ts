import { canonicalizeChinese } from './chinese-normalize';

const bracketed = /[（(]([^）)]+)[）)]/gu;
const han = /[\p{Script=Han}]+/gu;
const latin = /[A-Za-z][A-Za-z'’\s-]*/gu;
const VERSION_ONLY = /^(?:live|acoustic|instrumental|remix|karaoke|demo|unplugged|radio edit)$/iu;

export function isMedley(title: string): boolean {
  return /[\/+＋]/u.test(title);
}

export function medleyComponents(title: string): string[] {
  return title.replace(/^(?:組曲|组曲)\s*[:：]\s*/u, '')
    .split(/\s*[\/+＋]\s*/u)
    .map((part) => comparisonTitle(part).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
}

export function comparisonTitle(title: string): string {
  return canonicalizeChinese(title).replace(/祢/gu, '你');
}

export function titleVariants(title: string): string[] {
  const variants = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && !VERSION_ONLY.test(trimmed)) {
      variants.add(trimmed);
      variants.add(canonicalizeChinese(trimmed));
      variants.add(comparisonTitle(trimmed));
    }
  };
  add(title);
  for (const part of title.split(/\s*[\/+＋]\s*/u)) {
    add(part);
    add(part.replace(bracketed, ' '));
    for (const match of part.matchAll(bracketed)) add(match[1]);
    const chinese = [...part.matchAll(han)].map((match) => match[0]).join('');
    add(chinese);
    const english = [...part.matchAll(latin)].map((match) => match[0].trim()).filter(Boolean).join(' ');
    add(english);
  }
  return [...variants].filter(Boolean);
}
