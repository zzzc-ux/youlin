export type AccessPlace = {
  place: string;
  openHours: string;
  source: string;
  keywords: string[];
};

const places: AccessPlace[] = [
  {
    keywords: ["图书馆"],
    openHours: "周一至周日 7:00–22:30，周五整理闭馆日以当日通知为准",
    place: "图书馆",
    source: "图书馆开放时间说明",
  },
  {
    keywords: ["宿舍", "寝室"],
    openHours: "宿舍楼 6:00–23:00，23:00 后走晚归登记",
    place: "学生宿舍",
    source: "宿舍管理规定",
  },
  {
    keywords: ["教学楼", "教室"],
    openHours: "教学楼 6:30–22:00",
    place: "教学楼",
    source: "后勤处楼宇开放时间",
  },
  {
    keywords: ["体育馆", "操场"],
    openHours: "体育馆 8:00–21:00",
    place: "体育馆",
    source: "体育部场馆时间",
  },
];

export function queryAccessHours(text: string) {
  const hit = places.find((place) => place.keywords.some((keyword) => text.includes(keyword)));
  return hit ?? null;
}
