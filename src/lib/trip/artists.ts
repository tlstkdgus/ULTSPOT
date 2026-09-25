import collectedArtists from "./collected-artists.json";
export type Artist = { id: string; name: string; korean: string; aliases: string[]; kind: 'group' | 'person' | 'unit'; parentId?: string; source: string; birthday_mm_dd?: string; birthday_checked_on?: string; collected?: boolean };
const skz = 'https://straykids.jype.com/profile';
// Name/type/current membership checked against these official profiles on 2026-09-19.
// Member birthday month/day separately checked on 2026-09-20; no birth years or photos copied.
const reviewedArtists: Artist[] = [
  { id: 'A-JYP-SKZ', name: 'Stray Kids', korean: '스트레이 키즈', aliases: ['SKZ', '스트레이키즈'], kind: 'group', source: skz },
  { id: 'A-YG-BP', name: 'BLACKPINK', korean: '블랙핑크', aliases: [], kind: 'group', source: 'https://ygfamily.com/en/artists/blackpink/profile' },
  { id: 'A-YG-BM', name: 'BABYMONSTER', korean: '베이비몬스터', aliases: [], kind: 'group', source: 'https://ygfamily.com/en/artists/babymonster/profile' },
  ...[
    ['BANGCHAN', 'Bang Chan', '방찬', '10-03'], ['LEEKNOW', 'Lee Know', '리노', '10-25'], ['CHANGBIN', 'Changbin', '창빈', '08-11'],
    ['HYUNJIN', 'Hyunjin', '현진', '03-20'], ['HAN', 'Han', '한', '09-14'], ['FELIX', 'Felix', '필릭스', '09-15'],
    ['SEUNGMIN', 'Seungmin', '승민', '09-22'], ['IN', 'I.N', '아이엔', '02-08'],
  ].map(([id, name, korean, birthday_mm_dd]): Artist => ({ id: `P-JYP-${id}`, name, korean, birthday_mm_dd, birthday_checked_on: '2026-09-20', aliases: [], kind: 'person', parentId: 'A-JYP-SKZ', source: skz })),
  // T-065: 솔로 아티스트. 2026-09-25에 소속사 공식 페이지·위키백과로 이름·소속·생일(월-일)을 확인했다.
  // 생년·사진은 옮기지 않는다. 그룹 멤버로 이미 있는 태민·백현은 중복을 피해 넣지 않았다.
  ...[
    ['YENA', 'YENA', '최예나', '09-29', ['예나', 'Choi Yena', 'Choi Ye-na'], 'https://en.wikipedia.org/wiki/Choi_Ye-na'],
    ['PARKJIHOON', 'Park Jihoon', '박지훈', '05-29', ['Park Ji-hoon', '윙크남'], 'http://yyentertain.com/?page_id=2150'],
    ['IU', 'IU', '아이유', '05-16', ['이지은', 'Lee Ji-eun'], 'https://edam-ent.com/eng/sub03/sub03_0301_view'],
    ['CHUNGHA', 'CHUNG HA', '청하', '02-09', ['Chungha', '김청하'], 'https://chungha-official.com'],
    ['KWONEUNBI', 'Kwon Eunbi', '권은비', '09-27', ['Kwon Eun-bi', '은비'], 'https://en.wikipedia.org/wiki/Kwon_Eun-bi'],
    ['JOYURI', 'Jo Yuri', '조유리', '10-22', ['Jo Yu-ri', '유리'], 'https://wake-one.com/en/artists/jo-yuri/'],
    ['KANGDANIEL', 'Kang Daniel', '강다니엘', '12-10', ['KANGDANIEL', '다니엘'], 'https://kangdaniel.bstage.in'],
    ['KIMJAEHWAN', 'Kim Jaehwan', '김재환', '05-27', ['Kim Jae-hwan'], 'https://wake-one.com/artists/kim_jae-hwan'],
    ['HASUNGWOON', 'Ha Sungwoon', '하성운', '03-22', ['Ha Sung-woon'], 'https://en.wikipedia.org/wiki/Ha_Sung-woon'],
    ['LEECHAEYEON', 'Lee Chaeyeon', '이채연', '01-11', ['Lee Chae-yeon', '채연'], 'https://en.wikipedia.org/wiki/Lee_Chae-yeon'],
    ['CHUU', 'CHUU', '츄', '10-20', ['Chuu', '김지우'], 'https://en.wikipedia.org/wiki/Chuu_(singer)'],
    ['SUNMI', 'SUNMI', '선미', '05-02', ['Sunmi', '이선미'], 'https://en.wikipedia.org/wiki/Sunmi'],
    ['JEONSOMI', 'JEON SOMI', '전소미', '03-09', ['Somi', '소미'], 'https://jeonsomiofficial.com'],
    ['KIMJAEJOONG', 'Kim Jaejoong', '김재중', '01-26', ['Kim Jae-joong', '재중', 'Hero Jaejoong'], 'https://en.wikipedia.org/wiki/Kim_Jae-joong'],
    ['KIMSEJEONG', 'Kim Sejeong', '김세정', '08-28', ['Kim Se-jeong', '세정'], 'https://en.wikipedia.org/wiki/Kim_Se-jeong'],
  ].map(([id, name, korean, birthday_mm_dd, aliases, source]): Artist => ({
    id: `P-SOLO-${id}`, name: name as string, korean: korean as string, birthday_mm_dd: birthday_mm_dd as string,
    birthday_checked_on: '2026-09-25', aliases: aliases as string[], kind: 'person', source: source as string,
  })),
];
export const artists: Artist[] = [...reviewedArtists, ...(collectedArtists as Artist[]).filter(a => !reviewedArtists.some(existing => existing.id === a.id))];
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
export function matchesArtists(ids: string[] | undefined, selected: string[], artistSpecific = false) {
  if (selected.length && artistSpecific && !ids?.length) return false;
  if (!selected.length || !ids?.length) return true;
  const related = relatedArtistIds(selected);
  return ids.some(id => related.has(id));
}
