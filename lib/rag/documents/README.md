# RAG 知识库文档目录

本目录存放用于 RAG（检索增强生成）向量检索的 PDF 知识库文档。

## 用途约定

- 仅存放 `.pdf` 文件，作为向量化的原始语料来源
- 文件将在此目录内长期保留（进入 Git 版本管理），请勿存放含个人隐私或机密的文档
- 后续 RAG 流水线（解析 → 分块 → embedding → 入库 → 检索）代码位于 `lib/rag/`
- RAG 检索功能已实现：放入 PDF 后运行 `pnpm exec tsx lib/rag/build-index.ts` 重建索引，用 `pnpm exec tsx lib/rag/search-cli.ts "问题"` 测试检索

## 放置说明

把要纳入知识库的 PDF 直接放入本目录即可，例如：

```
lib/rag/documents/学生手册.pdf
lib/rag/documents/奖学金评定办法.pdf
```
