export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions"
  | "activate_gateway";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  activate_gateway: "response",
  api: "response",
  auth: "response",
  chat: "response",
  database: "log",
  document: "response",
  history: "response",
  stream: "response",
  suggestions: "response",
  vote: "response",
};

export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string | ErrorOptions) {
    const message = getMessageByErrorCode(errorCode);
    const options = typeof cause === "string" ? undefined : cause;

    super(message, options);

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    if (typeof cause === "string") {
      this.cause = cause;
    }
    this.surface = surface as Surface;
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      console.error({
        cause,
        code,
        message,
      });

      return Response.json(
        { code: "", message: "出了点问题，请稍后再试。" },
        { status: statusCode }
      );
    }

    return Response.json({ cause, code, message }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return "数据库查询出错，请稍后再试。";
  }

  switch (errorCode) {
    case "bad_request:api":
      return "请求无法处理，请检查输入后重试。";

    case "bad_request:activate_gateway":
      return "模型服务暂不可用，请联系管理员检查模型配置。";

    case "unauthorized:auth":
      return "请先登录。";
    case "forbidden:auth":
      return "你的账号没有使用这个功能的权限。";

    case "rate_limit:chat":
      return "提问次数已达上限，请一小时后再来。";
    case "not_found:chat":
      return "没有找到这个对话。";
    case "forbidden:chat":
      return "这个对话属于其他用户。";
    case "unauthorized:chat":
      return "请登录后查看这个对话。";
    case "offline:chat":
      return "消息发送失败，请检查网络后重试。";

    case "not_found:document":
      return "没有找到这个文档。";
    case "forbidden:document":
      return "这个文档属于其他用户。";
    case "unauthorized:document":
      return "请登录后查看这个文档。";
    case "bad_request:document":
      return "文档请求无效，请检查输入后重试。";

    default:
      return "出了点问题，请稍后再试。";
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
