import type { FanEvent } from "./planner";

// Individually reviewed factual records. No copied descriptions, photos, or competitor listings.
export const catalog: FanEvent[] = [
  {
    id: "hikr-ground", title: "HiKR Ground · K-pop floors", area: "Jung-gu", kind: "K-pop experience",
    address: "40 Cheonggyecheon-ro, Jung-gu, Seoul", from: null, to: null,
    opens: 600, closes: 1200, lastEntry: 1180, closedDays: [1], reservation: false,
    do: "Visit the public K-pop exhibition floors during opening hours. Check separate programs with the venue.",
    get: "Explore K-pop sets and interactive exhibits. General admission is free; special programs may have separate conditions.",
    provenance: { mode: "reviewed", author: "Korea Tourism Organization · venue website", checkedOn: "2026-09-19", url: "https://english.visitkorea.or.kr/svc/sp/hikr" },
  },
  {
    id: "music-korea", title: "Music Korea · Myeongdong 2", area: "Jung-gu", kind: "Album shop",
    address: "1F, 134 Toegye-ro, Jung-gu, Seoul", from: null, to: null,
    opens: 600, closes: 1320, closedDays: [], reservation: false,
    do: "Browse the store and pay for any albums you choose. Confirm stock and purchase benefits with staff.",
    get: "Purchased albums or merchandise. No fan-sign access or free gift is guaranteed.",
    provenance: { mode: "reviewed", author: "Music Korea · official store page", checkedOn: "2026-09-19", url: "https://www.musickorea.com/Mobile/Paper/view/code/store" },
  },
  {
    id: "k-star-road", title: "K-Star Road", area: "Gangnam-gu", kind: "Public fan landmark",
    address: "407 Apgujeong-ro, Gangnam-gu, Seoul", from: null, to: null,
    opens: null, closes: null, closedDays: [], reservation: false,
    do: "Check local access conditions before visiting the public street. Stay in public visitor areas.",
    get: "A public walking stop with K-pop themed sculptures. No artist meeting or private-building access is included.",
    provenance: { mode: "reviewed", author: "Korea Tourism Organization · destination listing", checkedOn: "2026-09-19", url: "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=72790" },
  },
];
