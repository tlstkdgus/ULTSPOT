export type Artist = { id: string; name: string; korean: string; aliases: string[]; kind: 'group' | 'person' | 'unit'; parentId?: string; source: string; birthday_mm_dd?: string; birthday_checked_on?: string };
const skz = 'https://straykids.jype.com/profile';
// Name/type/current membership checked against these official profiles on 2026-09-19.
// Member birthday month/day separately checked on 2026-09-20; no birth years or photos copied.
export const artists: Artist[] = [
  { id: 'A-JYP-SKZ', name: 'Stray Kids', korean: '스트레이 키즈', aliases: ['SKZ', '스트레이키즈'], kind: 'group', source: skz },
  { id: 'A-YG-BP', name: 'BLACKPINK', korean: '블랙핑크', aliases: [], kind: 'group', source: 'https://ygfamily.com/en/artists/blackpink/profile' },
  { id: 'A-YG-BM', name: 'BABYMONSTER', korean: '베이비몬스터', aliases: [], kind: 'group', source: 'https://ygfamily.com/en/artists/babymonster/profile' },
  ...[
    ['BANGCHAN', 'Bang Chan', '방찬', '10-03'], ['LEEKNOW', 'Lee Know', '리노', '10-25'], ['CHANGBIN', 'Changbin', '창빈', '08-11'],
    ['HYUNJIN', 'Hyunjin', '현진', '03-20'], ['HAN', 'Han', '한', '09-14'], ['FELIX', 'Felix', '필릭스', '09-15'],
    ['SEUNGMIN', 'Seungmin', '승민', '09-22'], ['IN', 'I.N', '아이엔', '02-08'],
  ].map(([id, name, korean, birthday_mm_dd]): Artist => ({ id: `P-JYP-${id}`, name, korean, birthday_mm_dd, birthday_checked_on: '2026-09-20', aliases: [], kind: 'person', parentId: 'A-JYP-SKZ', source: skz })),
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
