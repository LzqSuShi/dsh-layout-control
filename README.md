# dsh-layout-control · 布局控制

Web layout overlay for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): dock the composer, hide chrome, filter transcript nodes, and drive sidebar / details occupancy.

DeepSeek Harness Web UI 的独立布局插件：可拖动的「布局」按钮，隐藏会话装饰、停靠输入栏、过滤对话节点，并用 `ctx.layout` 控制侧边栏 / 详情栏。

不改 DSH 源码。只使用公开服务（`ctx.layout`、`ctx.slots`）和稳定 DOM 属性（`[data-slot]`、`[data-composer-seat]`、`[data-chat-flow-kind]` 等）。

仓库带 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，可用 `dsh plugin add` 安装。

## 功能

右下角圆形按钮打开面板（可拖到屏幕边缘，贴边后会收进一半，鼠标移上去再展开）：

- **快照**：默认 / 专注 / 沉浸
- **侧边栏**：展开 / 图标栏 / 隐藏（走 `ctx.layout`）
- **输入栏**：完整 / 紧凑 / 不显示。停靠位置是四个角：**左上 / 右上 / 左下 / 右下**（左右 × 贴顶/贴底）
- **详情栏**：开关；「清空内容」会派发 `dsh-details-clear`（原版 DSH 若未监听则可能无效果）
- **会话装饰**：顶栏、状态栏、任务条、其它浮层
- **对话内容**：全部 AI 输出、用户消息、思考、工具调用、任务清单、回复正文

四个角停靠后，对话仍在中间滚动。输入卡片连同待办一起贴在选中的角上（左上/右上把整块输入单元移到顶，待办仍在输入框上方）。同侧空出来的位置放可折叠的会话摘要卡。

内侧 8px 拖动手柄可改宽度（280–560px）。圆形入口位置记在本次标签页的 `sessionStorage`；其它查看状态不持久化，刷新回到默认快照。

## 安装

在未改过的 DeepSeek Harness 上安装，然后重启 `dsh web`，浏览器 Ctrl+F5。

GitHub（推荐）：

```bat
dsh plugin --profile web add github:LzqSuShi/dsh-layout-control
```

本地开发：

```bat
dsh plugin --profile web add "link:C:\liZhiQi\dsh-layout-control"
```

npm 发布之后：

```bat
dsh plugin --profile web add dsh-layout-control
```

本包提交了预构建的 `lib/`，git 安装不需要 `prepare` 构建许可。

## 卸载

```bat
dsh plugin --profile web remove dsh-layout-control
```

重启 `dsh web` 生效。

## 界面操作

| 控件 | 作用 |
| --- | --- |
| 圆形入口 | 单击打开 / 关闭面板；拖到左右边缘会收进一半，鼠标移上去再展开 |
| ESC | 关闭面板 |
| 输入栏「左上 / 右上 / 左下 / 右下」 | 把输入单元停到对应角，可拖内侧边改宽度 |
| 会话卡片标题 | 折叠 / 展开会话摘要 |

## 技术实现

1. 客户端模块：`window.__ModuleLoader__.load()` 注册，导出 `{ isPlugin, inject: ["layout", "slots"], apply }`
2. `apply(ctx)` 向 `shell.overlay` 注册一枚 React 浮层（id：`dsh-layout-control`），根节点带 `data-layout-control`，因此「隐藏装饰层」不会把本按钮一起藏掉
3. 隐藏 / 停靠 / 过滤全部是 `document.documentElement` 上的属性 + 一张 stylesheet，选择器只打公开锚点，不碰 CSS Module 哈希类名
4. 左右停靠时 `[data-conversation-scroll]` 仍是纵向滚动容器（ChatView 写它的 `scrollTop`）。对话列 `height: max-content`，输入座 `position: sticky` 并且高度等于滚动口可视高度
5. 停靠时用 CSS `::before` 画拖动手柄，用 window 指针事件改宽度，不往 React 树里插节点

`package.json` 声明 `dsh.bundle.patch`（`dsh plugin add` 可安装）和 `dsh.client`（Web 端注入 `layout`）。

## 已知限制

- 隐藏只是 `display: none`，对应 React 树仍挂着
- 「清空详情内容」依赖页面里已有的清空控件，或监听 `dsh-details-clear` 的 DSH 版本；原版可能清不掉 Inspect 选中项
- 停靠后的模型选择仍在输入卡片工具条里（不改 DSH 就无法把 Model / Effort 传送到卡片上方）
- 圆形入口可拖动；贴边半隐藏。其它浮层仍可能重叠

## 版权

代码 [MIT](./LICENSE)。与 DeepSeek 无官方关联。
