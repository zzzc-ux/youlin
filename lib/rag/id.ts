import { randomUUID } from "node:crypto";

export function createRandomId(): string {
  return randomUUID();
}
