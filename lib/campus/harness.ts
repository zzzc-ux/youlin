import { searchCampusKnowledge } from "@/lib/campus/knowledge";

export type CampusKind =
  | "notice"
  | "repair"
  | "card"
  | "access"
  | "forum"
  | "lost"
  | "qa"
  | "unknown";

export function classifyCampus(text: string): CampusKind {
  if (/(门禁|几点关门|几点开门|开放时间|闭馆|关门)/.test(text)) {
    return "access";
  }
  if (/(报修|维修|灯坏|漏水|空调坏|门锁坏)/.test(text) || /(宿舍|寝室|号楼)/.test(text) && /(坏了|不亮|报修)/.test(text)) {
    return "repair";
  }
  if (/(校园卡|一卡通)/.test(text) && /(余额|挂失|补卡|补办)/.test(text)) {
    return "card";
  }
  if (/(通知|公告|停水|停电|停暖)/.test(text)) {
    return "notice";
  }
  if (/(论坛|这周有什么|本周有什么|有什么活动|社团招新|招新|讲座)/.test(text)) {
    return "forum";
  }
  if (/(已经找回|找回了|找到了|已归还|已经归还|归还了|已送还|关闭这条|失物关闭)/.test(text)) {
    return "lost";
  }
  if (/(我丢了|丢失|不见了|掉了|遗失|捡到|拾到|失物|招领|寻物)/.test(text) || (/(校园卡|一卡通)/.test(text) && /丢了/.test(text))) {
    return "lost";
  }
  if (searchCampusKnowledge(text).length > 0) {
    return "qa";
  }
  return "unknown";
}

