/** Reduces common accidental disclosure; it is not a complete PII detector. */
export function redactPublicText(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[邮箱已隐藏]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[手机号已隐藏]")
    .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g, "[证件号已隐藏]")
    .replace(/((?:学号|身份证号|卡号|微信号|微信|姓名|名字)\s*[:：是为]?\s*)[A-Za-z0-9_\-\u4e00-\u9fff]{2,24}/g, "$1[已隐藏]");
}
