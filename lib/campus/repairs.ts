export type RepairTicket = {
  ticketId: string;
  place: string;
  item: string;
  detail: string;
  status: "已受理" | "维修中" | "已完成";
  updatedAt: string;
};

const tickets: RepairTicket[] = [
  {
    detail: "卫生间灯不亮。",
    item: "灯",
    place: "5号楼 208",
    status: "维修中",
    ticketId: "RX-5F208",
    updatedAt: "2026-11-16 19:20",
  },
];

function nowStamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createRepair(input: { place: string; item: string; detail: string }) {
  const ticket: RepairTicket = {
    detail: input.detail,
    item: input.item,
    place: input.place,
    status: "已受理",
    ticketId: `RX-${Date.now().toString(36).toUpperCase()}`,
    updatedAt: nowStamp(),
  };
  tickets.unshift(ticket);
  return ticket;
}

export function searchRepairs(query: string) {
  const text = query.trim();
  return tickets
    .filter((ticket) =>
      [ticket.ticketId, ticket.place, ticket.item, ticket.detail].some((field) =>
        text.includes(field) || field.includes(text)
      )
    )
    .slice(0, 5);
}
