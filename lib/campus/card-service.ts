export type CardAction = "loss" | "replace" | "balance";

export function campusCardService(action: CardAction) {
  if (action === "balance") {
    return {
      action,
      asOf: "2026-11-17 08:00",
      balance: "86.50 元",
      note: "这是样本余额，不是一卡通实时查询。",
      source: "一卡通中心样本账户",
    };
  }
  if (action === "replace") {
    return {
      action,
      materials: "学生证，工本费 20 元",
      note: "原卡余额在下一个工作日转入新卡。",
      source: "一卡通中心办事指南",
      window: "行政楼一层一卡通中心",
    };
  }
  return {
    action,
    cardStatus: "已挂失",
    note: "挂失后请尽快补办。临时就餐证明向辅导员领取。",
    since: "受理当时起",
    source: "一卡通中心办事指南",
  };
}
