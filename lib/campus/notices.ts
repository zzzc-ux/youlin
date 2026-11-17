export type CampusNotice = {
  title: string;
  source: string;
  publishedAt: string;
  audience: string;
  keywords: string[];
  body: string;
};

const notices: CampusNotice[] = [
  {
    audience: "6号楼",
    body: "6 号楼本周四 14:00 到 17:00 停水，请提前储水。恢复时间以楼栋通知为准。",
    keywords: ["停水", "6号楼", "宿舍"],
    publishedAt: "2026-11-16",
    source: "后勤处宿舍水电通知",
    title: "6 号楼周四停水",
  },
  {
    audience: "全校",
    body: "图书馆本周五闭馆整理，周六 8:00 恢复开放。周五已预约的座位自动取消。",
    keywords: ["图书馆", "闭馆", "开放"],
    publishedAt: "2026-11-15",
    source: "图书馆本周公告",
    title: "图书馆周五闭馆整理",
  },
  {
    audience: "全校",
    body: "本学期奖学金材料收于 11 月 28 日 17:00。材料清单以学院公示为准，逾期不再补收。",
    keywords: ["奖学金", "材料", "截止"],
    publishedAt: "2026-11-12",
    source: "学生处通知",
    title: "奖学金材料提交截止",
  },
];

export function searchNotices(query: string) {
  const text = query.trim();
  const hits = notices.filter((notice) =>
    [notice.title, notice.body, notice.audience, ...notice.keywords].some((field) =>
      text.includes(field) || field.includes(text.slice(0, 8))
    )
  );
  const picked = hits.length > 0 ? hits : text.length < 2 ? notices : [];
  return picked.slice(0, 5);
}
