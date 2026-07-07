# NexOps

现代化 SSH 工作台，面向开发者和运维团队。集成 SSH 终端、SFTP 文件管理、批量运维、数据库客户端和 AI 助手于一体。

> 对标 [electerm](https://github.com/electerm/electerm) / [Termius](https://termius.com)，全本地运行，数据不上传。

---

## 功能特性

| 模块 | 功能 | 版本 |
|------|------|------|
| **SSH 终端** | 密码/私钥/Agent 认证，多标签，跳板机，自动 resize，256 色 | v0.1 |
| **SFTP 文件管理** | 双击进目录，上传/下载，新建/重命名/删除，面包屑导航 | v0.1 |
| **主机管理** | 分组、搜索、右键菜单，SQLite 本地存储 | v0.1 |
| **命令片段库** | 保存常用命令，快速插入终端 | v0.1 |
| **批量运维** | 多主机并发执行命令，实时输出，独立停止，结果导出 CSV | v0.2 |
| **数据库客户端** | MySQL / PostgreSQL / Redis，SSH 隧道，查询历史，CSV 导出 | v0.3 |
| **AI 助手** | Ollama 本地 LLM 或 OpenAI-compatible API，流式输出，代码块渲染 | v0.4 |

### 路线图

| 版本 | 计划功能 |
|------|---------|
| v0.5 | 团队共享（主机列表共享 + RBAC 权限控制）|
| v0.6 | 操作审计 + 会话录制 |
| v1.0 | 端对端加密同步、RDP/VNC 支持 |

---

## 快速开始

### 环境要求

| 工具 | 最低版本 |
|------|---------|
| Node.js | 20.x |
| npm | 10.x |

**Windows** 额外需要：[Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（编译 `better-sqlite3` / `node-pty`）

**macOS** 额外需要：`xcode-select --install`

### 安装与运行

```bash
git clone https://github.com/125540947/nexops.git
cd nexops
npm install
npm run dev
```

### 打包发布

```bash
npm run dist
```

输出到 `dist/`：macOS → `.dmg`，Windows → `.exe`，Linux → `.AppImage`

---

## AI 助手配置

点击 Tab 栏右侧 **🤖 AI** 按钮，再点击 ⚙ 进入设置：

### Ollama（本地，推荐）

1. 安装 [Ollama](https://ollama.com)，运行 `ollama pull llama3.2`
2. Base URL 填 `http://localhost:11434`，点击 ↻ 刷新模型列表

### OpenAI-compatible API

1. 选择 "OpenAI-compatible" 提供商
2. 填入 Base URL（OpenAI 官方 / 第三方中转）和 API Key
3. 填入模型名称（如 `gpt-4o-mini`、`deepseek-chat`）

---

## 使用说明

### 终端

- **双击**主机 → 打开终端；**右键** → 选择终端或 SFTP
- 同一主机可开多个标签；关闭标签自动断开 SSH

### 批量运维

1. 点击侧边栏 **Batch** 按钮打开批量面板
2. 选择目标主机（支持多选），输入命令，点击 Run
3. 各主机输出实时显示；可单独停止某台主机

### 数据库

1. 点击侧边栏 **+DB** 添加连接（支持 SSH 隧道）
2. 点击连接名称打开查询面板
3. 在编辑器中输入 SQL，`Ctrl+Enter` 执行

---

## 项目结构

```
nexops/
├── electron/
│   ├── main/
│   │   ├── ai/index.ts        # AI 流式请求（Ollama / OpenAI）
│   │   ├── db/                # SQLite + Drizzle ORM
│   │   ├── ssh/               # SSH 连接池、PTY、SFTP、批量运维
│   │   └── ipc/index.ts       # 所有 IPC 接口注册
│   └── preload/index.ts       # contextBridge 安全 API
├── src/
│   ├── components/
│   │   ├── AI/AiPanel.tsx     # AI 聊天面板
│   │   ├── BatchOps/          # 批量运维面板
│   │   ├── Database/          # 数据库客户端
│   │   ├── FileManager/       # SFTP 面板
│   │   ├── Sidebar/           # 主机列表
│   │   └── Terminal/          # xterm.js 终端
│   ├── stores/app.ts          # Zustand 全局状态
│   └── App.tsx                # 根组件 + 标签页管理
├── shared/types.ts            # 主/渲染进程共享类型
├── scripts/release.sh         # 一键发布脚本
└── CHANGELOG.md
```

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | Electron 39 |
| 构建工具 | electron-vite 3 + Vite 6 |
| 前端 | React 19 + TypeScript |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 终端渲染 | xterm.js 5 |
| SSH | ssh2 + node-pty |
| 数据库 | better-sqlite3 + Drizzle ORM |
| DB 客户端 | mysql2 + pg + ioredis |

---

## 数据存储路径

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\nexops\nexops.db` |
| macOS | `~/Library/Application Support/nexops/nexops.db` |
| Linux | `~/.config/nexops/nexops.db` |

> ⚠️ 当前版本密码/私钥明文存储于 SQLite。v0.5 将引入加密存储。

---

## License

MIT
