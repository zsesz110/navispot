import { comparisonTitle } from './title-variants';

// Official bilingual song titles: https://sop.org/en/powerpoint/
// Each pair was also checked against the local Navidrome artist catalog.
const GROUPS = [
  ['You Surround Me', '围绕我'],
  ['This Is the Day', '这是耶和华所定日子'],
  ['My Voice Has Power', '我的声音带有能力'],
  ['Into Deeper Waters', '水深之处'],
  ['God of Miracles', '行神迹的神'],
  ['Come Close', '近前来'],
  ['Rain Down Your Power', '降下祢大能'],
  ['Trusting in Your Promises', '信靠每一句应许'],
  ['Let Me Stay', '能不能'],
  ['Come to Worship', '前来敬拜'],
  ['Glorious Calling', '荣耀的呼召'],
  ['My Abba Father', '天父'],
] as const;

function key(title: string): string {
  return comparisonTitle(title).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

const groupByKey = new Map<string, readonly string[]>();
for (const group of GROUPS) for (const name of group) groupByKey.set(key(name), group);

export function verifiedTitleAliases(title: string): string[] {
  return [...(groupByKey.get(key(title)) ?? [])].filter((name) => key(name) !== key(title));
}

export function areVerifiedTitleAliases(left: string, right: string): boolean {
  const group = groupByKey.get(key(left));
  return Boolean(group?.some((name) => key(name) === key(right)));
}
