import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { Artifact } from "@/components/chat/create-artifact";
import {
  CopyIcon,
  LineChartIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
} from "@/components/chat/icons";
import { SpreadsheetEditor } from "@/components/chat/sheet-editor";

type Metadata = Record<string, never>;

export const sheetArtifact = new Artifact<"sheet", Metadata>({
  actions: [
    {
      description: "查看上一版本",
      icon: <UndoIcon size={18} />,
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
    },
    {
      description: "查看下一版本",
      icon: <RedoIcon size={18} />,
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
    },
    {
      description: "复制为 CSV",
      icon: <CopyIcon />,
      onClick: ({ content }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });

        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== "")
        );

        const cleanedCsv = unparse(nonEmptyRows);

        navigator.clipboard.writeText(cleanedCsv);
        toast.success("CSV 已复制");
      },
    },
  ],
  content: ({ content, currentVersionIndex, onSaveContent, status }) => (
    <SpreadsheetEditor
      content={content}
      currentVersionIndex={currentVersionIndex}
      isCurrentVersion={true}
      saveContent={onSaveContent}
      status={status}
    />
  ),
  description: "用于处理表格",
  initialize: () => null,
  kind: "sheet",
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-sheetDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  toolbar: [
    {
      description: "整理数据",
      icon: <SparklesIcon />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          parts: [
            { text: "请帮我整理和清洗这份数据。", type: "text" },
          ],
          role: "user",
        });
      },
    },
    {
      description: "分析并可视化",
      icon: <LineChartIcon />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          parts: [
            {
              text: "请新建一个 Python 代码文档，分析并可视化这份数据。",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
  ],
});
