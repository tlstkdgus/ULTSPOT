export type Artist = { id: string; name: string; korean: string; aliases: string[]; kind: 'group' | 'person' | 'unit'; parentId?: string; source: string };
const skz = 'https://straykids.jype.com/profile';
// Name/type/current membership checked against these official profiles on 2026-09-19.
// No photos, biography copy, birthdays, agency contracts or event attendance implied.
export const artists: Artist[] = [
  { id: 'A-JYP-SKZ', name: 'Stray Kids', korean: '스트레이 키즈', aliases: ['SKZ', '스트레이키즈'], kind: 'group', source: skz },
  { id: 'A-YG-BP', name: 'BLACKPINK', korean: '블랙핑크', aliases: [], kind: 'group', source: 'https://ygfamily.com/en/artists/blackpink/profile' },
  { id: 'A-YG-BM', name: 'BABYMONSTER', korean: '베이비몬스터', aliases: [], kind: 'group', source: 'https://ygfamily.com/en/artists/babymonster/profile' },
  ...[
    ['BANGCHAN', 'Bang Chan', '방찬'], ['LEEKNOW', 'Lee Know', '리노'], ['CHANGBIN', 'Changbin', '창빈'],
    ['HYUNJIN', 'Hyunjin', '현진'], ['HAN', 'Han', '한'], ['FELIX', 'Felix', '필릭스'],
    ['SEUNGMIN', 'Seungmin', '승민'], ['IN', 'I.N', '아이엔'],
  ].map(([id, name, korean]): Artist => ({ id: `P-JYP-${id}`, name, korean, aliases: [], kind: 'person', parentId: 'A-JYP-SKZ', source: skz })),
];
const normalize = (value: string) => value.normalize('NFKD').replace(/[\s.\p{M}]/gu, '').toLowerCase();
export function searchArtists(query: string) {
  const key = normalize(query);
  return artists.filter(a => !key ? a.kind === 'group' : [a.name, a.korean, ...a.aliases].some(name => normalize(name).includes(key)));
}
// Expand down for a selected group/unit, up for a selected person. Never down
// again from a person's parent: that would incorrectly include other solo members.
export function relatedArtistIds(selected: string[]) {
  const result = new Set(selected.filter(id => artists.some(a => a.id === id)));
  for (const id of [...result]) {
    const artist = artists.find(a => a.id === id)!;
    if (artist.kind === 'person') {
      let parent = artist.parentId;
      while (parent && !result.has(parent)) { result.add(parent); parent = artists.find(a => a.id === parent)?.parentId; }
    } else {
      const queue = [id];
      for (let i = 0; i < queue.length; i++) for (const child of artists.filter(a => a.parentId === queue[i])) {
        if (!result.has(child.id)) { result.add(child.id); queue.push(child.id); }
      }
    }
  }
  return result;
}
export function matchesArtists(ids: string[] | undefined, selected: string[]) {
  if (!selected.length || !ids?.length) return true;
  const related = relatedArtistIds(selected);
  return ids.some(id => related.has(id));
}
