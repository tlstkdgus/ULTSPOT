/**
 * 캡처 대상 화면 목록. 새 화면을 만들면 여기에 추가한다.
 * name은 파일명에 쓰이므로 kebab-case로 둔다.
 */
export const captureRoutes = [
  { name: "home", path: "/" },
  { name: "design-system", path: "/design-system" },
] as const;
