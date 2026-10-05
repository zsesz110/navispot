import { canonicalArtistIdentity } from './artist-aliases';

export function artistComponents(artist: string): string[] {
  const parts = artist.split(/\s*,\s*|\s+&\s+|\s+(?:feat\.?|ft\.?|featuring|with)\s+/iu);
  return parts.flatMap((part) => {
    const trimmed = part.trim();
    if (!trimmed) return [];
    const mixed = trimmed.match(/^([A-Za-z][A-Za-z\s]+?)\s+([\p{Script=Han}].*)$/u);
    return mixed ? [trimmed, mixed[1].trim(), mixed[2].trim()] : [trimmed];
  });
}

export function artistIdentities(artists: string[]): string[] {
  return [...new Set(artists.flatMap(artistComponents).map(canonicalArtistIdentity))];
}
