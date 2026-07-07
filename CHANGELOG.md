# Changelog

## [v0.4] — 2026-07-07

### 新增

- **AI 助手面板** — Tab 栏右侧 🤖 按钮一键开关，360px 右侧抽屉布局
- **Ollama 支持** — 连接本地 Ollama 实例，一键刷新可用模型列表
- **OpenAI-compatible API 支持** — 可对接 OpenAI / 第三方中转 / DeepSeek 等任意兼容接口
- **流式输出** — 逐字符实时渲染，支持中途 Stop 打断
- **Markdown-lite 渲染** — 代码块语言标签 + 一键复制，行内 `` `code` `` 高亮
- **AI 设置持久化** — Provider、模型、System Prompt 保存到本地 SQLite，重启保留
- **System Prompt 自定义** — 默认为 DevOps/SRE 场景提示词，可在设置中修改

### 技术变更

- 新增 `electron/main/ai/index.ts`：`streamChat` / `abortChat` / `listOllamaModels`
- IPC 新增：`ai:chat` / `ai:abort` / `ai:models` / `ai:settings:get` / `ai:settings:save`
- Preload 新增 `window.nexops.ai` 命名空间，含 `onChunk` / `onDone` / `onError` 流式监听
- Store 新增 `aiPanelOpen` / `toggleAiPanel`

---

## [v0.3] — 2026-07-06

### 新增

- **数据库客户端** — 支持 MySQL、PostgreSQL、Redis
- **SSH 隧道** — 数据库连接可通过已配置的 SSH 主机建立隧道
- **SQL 编辑器** — 输入框执行 SQL，`Ctrl+Enter` 快捷键
- **结果表格** — 列宽自适应，支持 CSV 导出
- **查询历史** — 每次执行自动记录，点击可重新填入
- **连接测试** — 保存前可验证连通性及延迟
- **AddDbModal** — 统一的数据库连接创建弹窗

### 技术变更

- 新增 `electron/main/db/client.ts`：`executeDbQuery` / `testDbConnection`
- IPC 新增：`db:list` / `db:create` / `db:delete` / `db:test` / `db:query`
- Schema 新增 `db_connections` 表

---

## [v0.2] — 2026-07-05

### 新增

- **批量运维面板** — 多主机并发执行同一条命令
- **实时输出** — 每台主机独立输出区，逐行追加
- **独立控制** — 可停止单台主机或全部停止
- **状态标记** — pending / running / success / failed / stopped
- **结果导出** — 一键导出所有主机输出为 CSV

### 技术变更

- 新增 `electron/main/ssh/batch.ts`：`runBatchJob` / `stopBatchJob`
- IPC 新增：`batch:run` / `batch:stop` 及各主机事件频道

---

## [v0.1] — 2026-07-04

### 初始版本

- SSH 连接管理（密码 / 私钥 / SSH Agent，支持跳板机）
- 基于 xterm.js 的多标签终端，自动 resize，256 色
- SFTP 文件管理（列表、上传、下载、新建目录、重命名、删除）
- 主机分组与搜索
- 命令片段库
- 本地 SQLite 数据库（Drizzle ORM）
- 深色主题 UI（CSS 变量 + Tailwind CSS 4）
