import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { localChatModel, localTitleModel } from "./local-model";

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        titleModel: mockTitleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": mockTitleModel,
        },
      });
    })()
  : null;

export function hasModelProvider() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  if (!hasModelProvider()) {
    return localChatModel;
  }

  return deepseek.chat(DEEPSEEK_MODEL);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  if (!hasModelProvider()) {
    return localTitleModel;
  }

  return deepseek.chat(DEEPSEEK_MODEL);
}
