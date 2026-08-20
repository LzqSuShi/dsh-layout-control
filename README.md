# dsh-layout-control · 布局控制

DeepSeek Harness Web UI 的独立布局插件：右下角「布局」按钮，隐藏会话装饰、停靠输入栏、过滤对话节点，并用 `ctx.layout` 控制侧边栏 / 详情栏。

不改 DSH 源码。只使用公开服务（`ctx.layout`、`ctx.slots`）和稳定 DOM 属性（`[data-slot]`、`[data-composer-seat]`、`[data-chat-flow-kind]` 等）。

## 功能

右下角圆形按钮打开面板：

- **快照**：默认 / 专注 / 沉浸
- **侧边栏**：展开 / 图标栏 / 隐藏（走 `ctx.layout`）
- **输入栏**：完整 / 紧凑 / 右侧停靠 / 左侧停靠 / 不显示
- **详情栏**：开关；「清空内容」会派发 `dsh-details-clear`（原版 DSH 若未监听则可能无效果）
- **会话装饰**：顶栏、状态栏、任务条、其它浮层
- **对话内容**：全部 AI 输出、用户消息、思考、工具调用、任务清单、回复正文

停靠输入栏时，会话区变成左右两列（输入栏在会话格子内部，不是工作区侧栏）。内侧 8px 拖动手柄可改宽度（280–560px）。加载更早消息或切换会话时，滚动发生在对话列，输入栏不会被滚走。

查看状态不持久化：刷新页面回到默认快照。

## 安装

在未改过的 DeepSeek Harness 上安装（不要和曾经改过的 harness 源码叠在一起测）：

```bat
dsh plugin --profile web add "link:C:\liZhiQi\dsh-layout-control"
```

然后重启 `dsh web`，浏览器 Ctrl+F5 强刷。

GitHub 公开后也可以：

```bat
dsh plugin --profile web add https://github.com/LzqSuShi/dsh-layout-control
```

或（发布到 npm 之后）：

```bat
dsh plugin --profile web add dsh-layout-control
```

## 卸载

```bat
dsh plugin --profile web remove dsh-layout-control
```

重启 `dsh web` 生效。

## 界面操作

| 控件 | 作用 |
| --- | --- |
| 右下角按钮 | 打开 / 关闭布局面板 |
| ESC | 关闭面板 |
| 输入栏「右侧 / 左侧」 | 把输入卡片停靠成侧栏，可拖内侧边改宽度 |

## 技术实现

1. 客户端模块：`window.__ModuleLoader__.load()` 注册，导出 `{ isPlugin, inject: ["layout", "slots"], apply }`
2. `apply(ctx)` 向 `shell.overlay` 注册一枚 React 浮层（id：`dsh-layout-control`），根节点带 `data-layout-control`，因此「隐藏装饰层」不会把本按钮一起藏掉
3. 隐藏 / 停靠 / 过滤全部是 `document.documentElement` 上的属性 + 一张 stylesheet，选择器只打公开锚点，不碰 CSS Module 哈希类名
4. 停靠时对 `[data-conversation-scroll]` 做 CSS grid：一列是 `[data-slot="conversation.session"]`（或 `[data-conversation-transcript]`），一列是 `[data-composer-seat]`
5. `MutationObserver` 在停靠的 seat 上注入拖动手柄和标题条；卸载插件时移除

## 已知限制

- 隐藏只是 `display: none`，对应 React 树仍挂着
- 「清空详情内容」依赖页面里已有的清空控件，或监听 `dsh-details-clear` 的 DSH 版本；原版可能清不掉 Inspect 选中项
- 停靠后的模型选择仍在输入卡片工具条里（不改 DSH 就无法把 Model / Effort 传送到卡片上方）
- 与其它同样占用右下角的浮层可能重叠，本插件会按详情栏宽度把按钮往左让

## 版权

代码 MIT。与 DeepSeek 无官方关联。
