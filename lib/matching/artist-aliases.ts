import { canonicalizeChinese } from './chinese-normalize';

const ALIAS_GROUPS = [
  { identity: 'joshua-band', names: ['Joshua Band', '约书亚乐团', '約書亞樂團'] },
  { identity: 'stream-of-praise', names: [
    'Stream of Praise', '赞美之泉', '讚美之泉', '赞美之泉音乐事工', '讚美之泉音樂事工',
  ] },
  { identity: 'lamb-music', names: ['Lamb Music', '小羊詩歌', '小羊诗歌'] },
] as const;

function aliasKey(name: string): string {
  return canonicalizeChinese(name.normalize('NFKC').toLowerCase())
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

const aliases = new Map<string, string>(
  ALIAS_GROUPS.flatMap(({ identity, names }) => names.map((name) => [aliasKey(name), identity] as const)),
);

export function canonicalArtistIdentity(name: string): string {
  const key = aliasKey(name);
  return aliases.get(key) ?? key;
}
