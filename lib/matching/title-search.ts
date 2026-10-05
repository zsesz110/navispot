import { canonicalizeChinese } from './chinese-normalize';
import { titleVariants } from './title-variants';

const TITLE_SUFFIX_PATTERN = /[\(\[].*?[\)\]]\s*$|[-–—~/].*$/;

export function stripTitleSuffix(title: string): string {
  let result = title;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(TITLE_SUFFIX_PATTERN, '').trim();
  }
  return result;
}

export function titleSearchQueries(title: string): string[] {
  const canonical = canonicalizeChinese(title);
  return [...new Set([
    ...titleVariants(title),
    stripTitleSuffix(title),
    stripTitleSuffix(canonical),
  ].filter(Boolean))];
}
