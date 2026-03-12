# NarraFork Launcher

NarraFork 桌面启动器应用，用于管理 NarraFork Worker 进程的启动、停止和监控。

## 功能特性

### Worker 进程管理
- 启动/停止/重启 NarraFork Worker 进程
- 实时查看 Worker 日志输出（支持 ANSI 彩色日志）
- 自动检测 Worker 可执行文件位置
- 配置自定义端口和主机地址
- 启动时自动运行 Worker

### 浏览器集成
- **内嵌模式**: 在应用内 WebView 窗口中打开 NarraFork
- **外部模式**: 在系统默认浏览器中打开
- 清除浏览数据（Cookies、缓存、LocalStorage 等）
- Service Worker 管理（查看、注销、更新）

### 依赖检测
- 检测必需工具：Git
- 检测推荐工具：ripgrep、Podman（Linux）
- Git 用户配置管理（user.name / user.email）

### 更新管理
- 从 GitHub Releases 检查更新
- 下载并安装新版本
- 支持稳定版/Beta 版本通道

### 系统集成
- 系统托盘支持（最小化到托盘）
- 关闭窗口时可选择最小化或退出
- 跨平台支持（Windows、macOS、Linux）

### 用户界面
- 深色/浅色主题切换
- 多语言支持（中文/英文）
- 自定义无边框窗口标题栏

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite |
| UI 框架 | Mantine 7 |
| 桌面框架 | Tauri 2 |
| 后端语言 | Rust |
| 图标 | Tabler Icons |
| 国际化 | i18next + react-i18next |
| HTTP 客户端 | reqwest |

## 项目结构

```
launcher-gui/
├── src/                          # React 前端源码
│   ├── components/
│   │   ├── TitleBar.tsx          # 自定义标题栏
│   │   ├── Terminal.tsx          # 日志终端组件
│   │   ├── Settings.tsx          # 设置面板
│   │   ├── Dependencies.tsx      # 依赖检测面板
│   │   ├── Updates.tsx           # 更新管理面板
│   │   └── Feedback.tsx          # 反馈面板
│   ├── hooks/
│   │   └── useTauri.ts           # Tauri API 封装 Hooks
│   ├── i18n/
│   │   ├── index.ts              # i18n 配置
│   │   └── locales/              # 语言文件
│   ├── lib/
│   │   └── api.ts                # Tauri 命令 API 封装
│   ├── App.tsx                   # 主应用组件
│   └── main.tsx                  # 入口文件
├── src-tauri/                    # Tauri/Rust 后端
│   ├── src/
│   │   ├── lib.rs                # Tauri 应用入口
│   │   ├── main.rs               # Rust main 函数
│   │   ├── config.rs             # 配置管理
│   │   ├── worker.rs             # Worker 进程管理
│   │   ├── deps.rs               # 依赖检测
│   │   ├── updater.rs            # 更新管理
│   │   └── browser.rs            # 浏览器/Service Worker 管理
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 配置
├── public/                       # 静态资源
└── dist/                         # 构建输出
```

## 配置文件

配置文件位于 `~/.narrafork/launcher-config.json`：

```json
{
  "worker": {
    "path": null,           // Worker 可执行文件路径（null 自动检测）
    "port": 7779,           // Worker 端口
    "host": "127.0.0.1",    // Worker 主机
    "autoStart": true       // 启动时自动运行
  },
  "launch": {
    "mode": "inline",       // "inline" 内嵌窗口 | "external" 外部浏览器
    "closeAction": "minimize" // "minimize" 最小化到托盘 | "quit" 退出
  },
  "git": {
    "name": "",             // Git 用户名
    "email": ""             // Git 邮箱
  },
  "updates": {
    "autoCheck": true,      // 自动检查更新
    "channel": "stable"     // "stable" | "beta"
  }
}
```

## 环境要求

- Node.js 18+
- pnpm
- Rust（最新稳定版）
- 平台依赖：
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: webkit2gtk、file-dev 等（参考 [Tauri 环境要求](https://tauri.app/start/prerequisites/)）

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm tauri dev
```

### 构建发布

```bash
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

## Worker 可执行文件检测顺序

启动器按以下顺序查找 Worker 可执行文件：

1. 配置文件中指定的 `worker.path`
2. 启动器同目录下的 `narrafork-worker` 或 `narrafork`
3. 启动器同目录下版本化名称（如 `narrafork-0.1.0-windows-x64`）
4. `~/.narrafork/bin/` 目录
5. `/opt/narrafork/` 目录（Linux）
6. `/usr/local/bin/` 目录

## 许可证

MIT
