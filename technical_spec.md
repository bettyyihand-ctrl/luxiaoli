# 路小理 (Lexora) - 技术方案与关键功能说明

本文档旨在梳理“路小理”项目的技术架构、关键功能，并详细说明其代码实现逻辑以及与腾讯元器工作流的对接方式。此文档可作为后续撰写项目简介、需求分析及AI提示词设计等内容的基础材料。

## 1. 项目基础信息

- **项目名称**：路小理 (Lexora) - 交通纠纷法律智能助手
- **核心定位**：将交通事故线索和情况描述，通过AI整理成可行动的赔偿计算、法律咨询意见和标准的法律文书。
- **技术栈**：
  - **前端框架**：Next.js 16 (App Router), React 19
  - **UI 与样式**：Tailwind CSS v4, Lucide React (图标)
  - **编程语言**：TypeScript
  - **文档生成**：`docxtemplater`, `pizzip`
  - **大模型接入**：腾讯元器 API (流式输出 Server-Sent Events)
  - **安全与认证**：JWT (基于 `jose` 库), Next.js Middleware 路由拦截
- **部署与环境**：支持 Vercel 部署，通过 `.env.local` 管理敏感密钥（如 `YUANQI_API_TOKEN`, `YUANQI_ASSISTANT_ID`, `APP_PASSWORD`, `AUTH_SECRET`）。

## 2. 系统技术方案与架构思路

该项目从传统的 Vanilla JS/HTML/CSS 架构迁移至现代 Next.js (App Router) 架构，利用 React Server Components 与 Client Components 的混合优势，提升了安全性和交互体验。

### 2.1 架构分层
1. **视图层 (Client Components)**：主要集中在 `app/page.tsx`。负责管理会话状态（模式切换、输入、消息列表、文书下载），并接收从后端透传的流式 API 响应，利用 `react-markdown` 实时渲染 Markdown 内容。
2. **API 网关/路由代理层 (Next.js Middleware)**：`proxy.ts` 负责全局路由拦截。除了公开的 `/login` 和静态资源外，所有路由均校验 Cookie 中的 JWT 令牌，保障了系统整体在未授权时不可访问。
3. **服务端逻辑层 (Route Handlers)**：
   - `/api/chat`：充当 AI 接口的 Bff (Backend for Frontend)。它封装了腾讯元器的 API Token，接收前端组装的对话历史和自定义变量，并利用 Fetch API 建立与元器的流式连接（SSE），然后将流直接 `pipe` 回前端，确保前端不在客户端暴露 API 密钥。
   - `/api/generate-doc`：处理前端发起的文档下载请求。接收 AI 生成的纯文本，使用内部的正则解析工具提取关键字段，并结合位于 `doc/template/` 下的 Word 模板进行变量替换，最终生成并返回 `.docx` 格式的 Blob 数据。

## 3. 关键功能说明与代码实现细节

### 3.1 智能问答与多模式切换
- **功能描述**：系统提供四种模式：“计算”（估算赔偿金额）、“咨询”（法律问题咨询）、“文书”（起草和解协议、起诉状、证据目录）以及仅在开发环境可见的“霍格沃茨”（调试模式）。
- **代码实现**：
  - 前端 `app/page.tsx` 中定义了 `ActionMode` 类型，并通过 `useState` 管理当前选中的模式。
  - 用户输入内容后，触发 `handleSend` 方法，前端不仅发送用户的聊天记录，还会将当前模式作为 `actionType`，如果处于“文书”模式，还会传递具体的 `docType`。这些额外信息通过 payload 的 `custom_variables` 字段发送给 `/api/chat`。

### 3.2 与腾讯元器工作流的对接逻辑
- **对接方式**：基于腾讯元器的智能体/工作流 API。
- **参数传递 (`app/page.tsx` & `/api/chat/route.ts`)**：
  ```javascript
  const apiPayload = {
    messages: [/* 会话历史 */],
    custom_variables: {
      actionType: selectedMode, // "计算" | "咨询" | "文书"
      // 文书模式下特有的变量
      ...(selectedMode === '文书' ? { docType: selectedDocType } : {}),
      // 将之前提取的用户上下文信息传回给大模型，辅助其记忆
      ...(selectedMode !== '文书' && Object.keys(userContext).length > 0
        ? { userContext: JSON.stringify(userContext) }
        : {})
    }
  };
  ```
  在 `/api/chat/route.ts` 中，这些参数连同存储在服务端的 `YUANQI_ASSISTANT_ID` 和 `YUANQI_API_TOKEN` 一起构建向 `https://yuanqi.tencent.com/openapi/v1/agent/chat/completions` 的 POST 请求。
- **流式响应解析**：
  在前端，通过 `response.body.getReader()` 读取数据流，识别以 `data: ` 开头的 SSE 消息结构，提取 `choices[0].delta.content`，并动态更新 UI 中的 `rawText` 从而实现打字机效果。

### 3.3 用户上下文动态抽取与传递
- **功能描述**：AI 在回答过程中，不仅会输出给用户看的内容，还可以通过特定标签（`<data>...</data>`）输出结构化的 JSON 状态，用于前端的状态维护。
- **代码实现**：
  - 在 `lib/markdown.ts` 中的 `parseUserContext` 方法使用正则表达式 `/<data>([\s\S]*?)<\/data>/g` 截获流式响应中的数据。
  - 解析得到的 JSON 对象会被合并到前端组件的状态 `userContext` 中。
  - 在随后的对话请求中，`userContext` 会通过 `custom_variables.userContext` 再次回传给元器模型。这就使得模型和工作流能在多轮对话中“记住”已提取的案件事实（如事故发生地、年龄、住院天数等），从而避免重复询问。
  - `sanitizeMarkdownText` 负责在最终渲染给用户看的 Markdown 中将 `<data>` 标签剔除，保障界面整洁。

### 3.4 法律文书生成与导出
- **功能描述**：用户在“文书”模式下，AI 会生成符合特定格式的草稿。前端随后提供一键下载 Word 文档的按钮。
- **工作流与模板结合**：
  1. AI 按照预设 prompt 结构化地输出文本（包括特定字段如“原告：XXX”，“赔偿金额：XXX元”）。
  2. 前端请求 `/api/generate-doc`，并携带 AI 生成的完整纯文本内容 `rawText` 及文书类型 `docType`。
  3. **字段提取**：服务端调用 `lib/docFields.ts` 中的 `extractDocFields` 函数。该函数通过大量的正则表达式分析大模型的输出，从中提炼出所需字段，如 `party_a_name`, `accident_date`, `total_compensation` 等等。
  4. **模板渲染**：服务端利用 `pizzip` 加载 `doc/template/` 下预置好的 Word 模板（如 `交通事故和解协议.docx`），然后通过 `docxtemplater` 执行双大括号（如 `{{party_a_name}}`）的数据替换。
  5. 最终生成 `Buffer` 并作为文件流返回前端，触发浏览器的自动下载。

## 4. 总结 (提供给写 Prompt 和项目说明的 AI 的建议)
1. **元器工作流设计**：在配置腾讯元器的 Agent 时，需利用 `custom_variables.actionType` 进行意图分发。若 `actionType = "计算"`，需引导 Agent 收集特定要素；若为 `"文书"`，则利用 `docType` 确定起草文书的类型框架。
2. **结构化输出约束**：为了保证文书生成模块（`extractDocFields`）的正则匹配不失效，必须在 Agent 的 Prompt 中强约束其输出格式（例如：强制要求使用标准的“甲方：XXX”、“合计人民币 XXX 元”的冒号+实体格式）。
3. **隐式数据交互**：Agent 在收集到关键信息时，可以被训练为主动输出 `<data>{"medical_fee": 1000}</data>` 这样的 JSON，利用本系统的前后端配合来实现状态驻留。
