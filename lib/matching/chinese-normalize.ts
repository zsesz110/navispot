import OpenCC from 'opencc-js/t2cn';

// The smaller Traditional-to-Simplified build keeps this usable in the client bundle.
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

export function canonicalizeChinese(value: string): string {
  return toSimplified(value);
}
