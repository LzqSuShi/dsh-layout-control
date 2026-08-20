/**
 * dsh-layout-control — DeepSeek Harness Web layout overlay (browser half).
 *
 * 1. window.__ModuleLoader__.load() registers this package as a client module.
 * 2. Exports { isPlugin, inject: ["layout", "slots"], apply }.
 * 3. apply(ctx) registers a shell.overlay React entry and installs a
 *    stylesheet that targets public [data-slot] / [data-composer-seat] /
 *    [data-chat-flow-kind] anchors. Column occupancy goes through ctx.layout.
 * 4. Side-dock keeps overflow-y on [data-conversation-scroll] (ChatView
 *    writes scrollTop there). The seat is position:sticky at the port
 *    height; the inner edge is a CSS ::before handle.
 */
window.__ModuleLoader__.load({
  id: 'dsh-layout-control',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')

    const PLUGIN_ID = 'dsh-layout-control'
    const HIDE_ATTR = 'data-dsh-layout-hide'
    const COMPOSER_ATTR = 'data-dsh-layout-composer'
    const NODE_ATTR = 'data-dsh-layout-nodes'
    const AI_ATTR = 'data-dsh-layout-ai'
    const ALIGN_ATTR = 'data-dsh-layout-card'
    const DETAILS_WIDTH_VAR = '--dsh-layout-control-details-width'
    const PORT_H_VAR = '--dsh-layout-control-port-h'
    const DOCK_WIDTH_VAR = '--dsh-composer-dock-width'
    const DOCK_MIN = 280
    const DOCK_MAX = 560
    const DOCK_DEFAULT = 360
    const FAB_KEY = 'dsh-layout-control-fab'
    const FAB_SIZE = 36
    const FAB_MARGIN = 16
    const DETAILS_CLEAR_EVENT = 'dsh-details-clear'

    const CHROME_IDS = ['header', 'stats', 'dock', 'overlays']
    const COMPOSER_MODES = ['full', 'compact', 'hidden']
    const DOCK_CORNERS = [
      { id: 'left-top', side: 'dock-left', align: 'top' },
      { id: 'right-top', side: 'dock-right', align: 'top' },
      { id: 'left-bottom', side: 'dock-left', align: 'bottom' },
      { id: 'right-bottom', side: 'dock-right', align: 'bottom' },
    ]
    const NODE_IDS = ['user', 'think', 'tools', 'todos', 'reply']
    const SIDEBAR_MODES = ['expanded', 'rail', 'hidden']
    const PRESET_IDS = ['default', 'focus', 'zen']

    const zh = {
      'toggle.open': '打开布局',
      'toggle.close': '关闭布局',
      'panel.title': '布局',
      'preset.default': '默认',
      'preset.focus': '专注',
      'preset.zen': '沉浸',
      'sidebar.label': '侧边栏',
      'sidebar.expanded': '展开',
      'sidebar.rail': '图标栏',
      'sidebar.hidden': '隐藏',
      'details.label': '详情栏',
      'details.clear': '清空内容',
      'composer.label': '输入栏',
      'composer.full': '完整',
      'composer.compact': '紧凑',
      'composer.hidden': '不显示',
      'composer.corner': '停靠位置',
      'composer.left-top': '左上',
      'composer.right-top': '右上',
      'composer.left-bottom': '左下',
      'composer.right-bottom': '右下',
      'composer.resize': '调整输入栏宽度',
      'composer.dock-hint': '拖动内侧边缘可调整宽度',
      'extras.session': '会话',
      'extras.fold': '折叠会话',
      'extras.expand': '展开会话',
      'extras.recent': '最近',
      'extras.you': '你',
      'extras.assistant': '助手',
      'nodes.ai': '全部 AI 输出',
      'chrome.header': '会话顶栏',
      'chrome.stats': '状态栏',
      'chrome.dock': '任务条',
      'chrome.overlays': '装饰层',
      'nodes.label': '对话内容',
      'nodes.user': '用户消息',
      'nodes.think': '思考',
      'nodes.tools': '工具调用',
      'nodes.todos': '任务清单',
      'nodes.reply': '回复正文',
    }

    const en = {
      'toggle.open': 'Open layout',
      'toggle.close': 'Close layout',
      'panel.title': 'Layout',
      'preset.default': 'Default',
      'preset.focus': 'Focus',
      'preset.zen': 'Immersive',
      'sidebar.label': 'Sidebar',
      'sidebar.expanded': 'Expanded',
      'sidebar.rail': 'Icon rail',
      'sidebar.hidden': 'Hidden',
      'details.label': 'Details',
      'details.clear': 'Clear contents',
      'composer.label': 'Composer',
      'composer.full': 'Full',
      'composer.compact': 'Compact',
      'composer.hidden': 'Off',
      'composer.corner': 'Dock',
      'composer.left-top': 'Left top',
      'composer.right-top': 'Right top',
      'composer.left-bottom': 'Left bottom',
      'composer.right-bottom': 'Right bottom',
      'composer.resize': 'Resize composer',
      'composer.dock-hint': 'Drag the inner edge to resize',
      'extras.session': 'Session',
      'extras.fold': 'Collapse session',
      'extras.expand': 'Expand session',
      'extras.recent': 'Recent',
      'extras.you': 'You',
      'extras.assistant': 'Assistant',
      'nodes.ai': 'All AI output',
      'chrome.header': 'Session header',
      'chrome.stats': 'Status line',
      'chrome.dock': 'Task dock',
      'chrome.overlays': 'Decorations',
      'nodes.label': 'Transcript',
      'nodes.user': 'User messages',
      'nodes.think': 'Think',
      'nodes.tools': 'Tool calls',
      'nodes.todos': 'Task list',
      'nodes.reply': 'Reply text',
    }

    const VISIBLE_CHROME = { header: true, stats: true, dock: true, overlays: true }
    const VISIBLE_NODES = { user: true, think: true, tools: true, todos: true, reply: true }

    const PRESETS = {
      default: {
        sidebar: 'expanded',
        details: false,
        composer: 'full',
        cardAlign: 'bottom',
        chrome: { ...VISIBLE_CHROME },
        nodes: { ...VISIBLE_NODES },
      },
      focus: {
        sidebar: 'rail',
        details: false,
        composer: 'dock-right',
        cardAlign: 'bottom',
        chrome: { header: true, stats: false, dock: true, overlays: false },
        nodes: { ...VISIBLE_NODES },
      },
      zen: {
        sidebar: 'hidden',
        details: false,
        composer: 'dock-right',
        cardAlign: 'bottom',
        chrome: { header: false, stats: false, dock: false, overlays: false },
        nodes: { user: true, think: false, tools: false, todos: false, reply: true },
      },
    }

    const REPLY_FLOW = [
      '[data-chat-flow-kind="turn-tail"]',
      '[data-chat-flow-kind="context"]',
      '[data-chat-flow-kind="command"]',
      '[data-chat-flow-kind="compaction"]',
      '[data-chat-flow-kind="manual-compaction"]',
      '[data-chat-flow-kind="model-retry"]',
      '[data-chat-flow-kind="turn-error"]',
      '[data-chat-flow-kind="turn-max-tokens"]',
      '[data-chat-flow-kind="unknown"]',
      '[data-chat-turn-status]',
    ].join(', ')

    function h(tag, props, ...children) {
      return React.createElement(tag, props, ...children)
    }

    function isZh() {
      const lang = (document.documentElement.lang || navigator.language || '').toLowerCase()
      return lang.startsWith('zh')
    }

    function t(key) {
      return (isZh() ? zh : en)[key] ?? key
    }

    function cloneFlags(src, keys) {
      const next = {}
      for (const key of keys) next[key] = src[key]
      return next
    }

    function cloneState(state) {
      return {
        sidebar: state.sidebar,
        details: state.details,
        composer: state.composer,
        cardAlign: state.cardAlign,
        chrome: cloneFlags(state.chrome, CHROME_IDS),
        nodes: cloneFlags(state.nodes, NODE_IDS),
      }
    }

    function sameFlags(left, right, keys) {
      return keys.every((key) => left[key] === right[key])
    }

    function matchingPreset(state) {
      for (const id of PRESET_IDS) {
        const preset = PRESETS[id]
        if (
          state.sidebar === preset.sidebar
          && state.composer === preset.composer
          && state.cardAlign === preset.cardAlign
          && sameFlags(state.chrome, preset.chrome, CHROME_IDS)
          && sameFlags(state.nodes, preset.nodes, NODE_IDS)
        ) return id
      }
      return undefined
    }

    function hiddenOf(map, ids) {
      return ids.filter((id) => !map[id])
    }

    function writeTokenAttribute(attr, tokens) {
      const el = document.documentElement
      if (tokens.length === 0) el.removeAttribute(attr)
      else el.setAttribute(attr, tokens.join(' '))
    }

    function writeHideAttribute(hidden) {
      writeTokenAttribute(HIDE_ATTR, hidden)
    }

    function writeNodeAttribute(hidden) {
      writeTokenAttribute(NODE_ATTR, hidden)
    }

    function clampDockWidth(px) {
      return Math.min(DOCK_MAX, Math.max(DOCK_MIN, Math.round(px)))
    }

    function readDockWidth() {
      const parsed = Number.parseFloat(document.documentElement.style.getPropertyValue(DOCK_WIDTH_VAR))
      return Number.isFinite(parsed) ? clampDockWidth(parsed) : DOCK_DEFAULT
    }

    function writeDockWidth(px) {
      document.documentElement.style.setProperty(DOCK_WIDTH_VAR, `${clampDockWidth(px)}px`)
    }

    function writeComposerAttribute(mode) {
      const el = document.documentElement
      if (mode === 'full') el.removeAttribute(COMPOSER_ATTR)
      else el.setAttribute(COMPOSER_ATTR, mode)
      if (mode === 'dock-left' || mode === 'dock-right') {
        if (el.style.getPropertyValue(DOCK_WIDTH_VAR) === '') writeDockWidth(DOCK_DEFAULT)
      }
    }

    function writeCardAlign(align) {
      const el = document.documentElement
      if (align === 'bottom') el.removeAttribute(ALIGN_ATTR)
      else el.setAttribute(ALIGN_ATTR, align)
    }

    function writeAiAttribute(hidden) {
      if (hidden) document.documentElement.setAttribute(AI_ATTR, 'hidden')
      else document.documentElement.removeAttribute(AI_ATTR)
    }

    function isComposerDocked() {
      const mode = document.documentElement.getAttribute(COMPOSER_ATTR)
      return mode === 'dock-left' || mode === 'dock-right'
    }

    function clearAttributes() {
      const el = document.documentElement
      el.removeAttribute(HIDE_ATTR)
      el.removeAttribute(COMPOSER_ATTR)
      el.removeAttribute(ALIGN_ATTR)
      el.removeAttribute(NODE_ATTR)
      el.removeAttribute(AI_ATTR)
      el.style.removeProperty(DOCK_WIDTH_VAR)
      el.style.removeProperty(DETAILS_WIDTH_VAR)
    }

    function dockSeat(side) {
      const attr = side === 'right' ? 'dock-right' : 'dock-left'
      const width = `var(${DOCK_WIDTH_VAR}, ${DOCK_DEFAULT}px)`
      const portH = `var(${PORT_H_VAR}, 100%)`
      const prefix = `html[${COMPOSER_ATTR}="${attr}"]`
      const scroll = `${prefix} :is([data-phase="active"], [data-phase="settling"]) > [data-conversation-scroll]:not(:has([data-conversation-composer-overlay]))`
      const dir = side === 'right' ? 'row' : 'row-reverse'
      const handleEdge = side === 'right' ? 'left' : 'right'
      const stack = `${prefix} [data-composer-seat] > *, ${prefix} [data-composer-seat] *:has(> [data-composer-card])`
      return [
        `${prefix} [data-phase="settling"] [data-composer-seat] { visibility: visible !important; }`,
        `${scroll} { display: flex !important; flex-direction: ${dir} !important; align-items: flex-start !important; overflow-x: hidden !important; overflow-y: auto !important; }`,
        `${scroll} > [data-slot="conversation.session"] > *, ${scroll} > [data-conversation-transcript] { flex: 1 1 auto; min-width: 0; width: auto; height: max-content !important; max-height: none !important; min-height: auto !important; overflow: visible !important; }`,
        `${scroll} > [data-composer-seat] { position: sticky !important; align-self: flex-start !important; top: 0 !important; bottom: auto !important; flex: 0 0 ${width}; width: ${width}; min-width: ${width}; height: ${portH} !important; max-height: ${portH}; min-height: 160px; overflow: visible; display: flex !important; flex-direction: column; justify-content: flex-end; gap: 8px; padding: 12px 10px; box-sizing: border-box; background: color-mix(in srgb, var(--dsw-alias-bg-base) 42%, transparent); border-${handleEdge}: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 70%, transparent); z-index: 7; --dsh-composer-card-max-width: 100%; --dsh-composer-side-clearance: 8px; --dsh-composer-text-max-height: 140px; --dsh-chat-content-width: 100%; }`,
        `${prefix}[${ALIGN_ATTR}="top"] [data-composer-seat] { justify-content: flex-start !important; }`,
        `${stack} { display: flex !important; flex-direction: column; flex: 0 0 auto; min-height: min-content; height: auto; width: 100%; max-width: none; box-sizing: border-box; align-items: stretch !important; }`,
        `${prefix} [data-slot="conversation.input.dock"] { flex: 0 0 auto; min-height: 0; max-height: min(40vh, 280px); overflow-y: auto; }`,
        `${prefix} [data-composer-card] { flex: 0 0 auto; width: 100%; min-height: 88px; max-width: none !important; visibility: visible !important; opacity: 1 !important; }`,
        `${prefix} [data-composer-seat] *:has(> [data-composer-card]) { flex: 0 0 auto; height: auto; }`,
        `${prefix} [data-slot="conversation.input.model"] { max-width: 100%; }`,
        `${prefix} [data-chat-to-bottom] { bottom: 16px !important; }`,
        `${prefix} [data-composer-seat]::before { content: ""; position: absolute; top: 0; bottom: 0; ${handleEdge}: 0; width: 8px; z-index: 4; cursor: col-resize; }`,
        `${prefix} [data-composer-seat]:hover::before { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent); }`,
        `${prefix}[data-dlc-dock-dragging] [data-composer-seat]::before { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent); }`,
      ].join('\n')
    }

    const UI_STYLE = `
[data-layout-control] {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: visible;
  pointer-events: none !important;
}
[data-layout-control] .dlc-cluster {
  position: absolute;
  right: calc(16px + var(${DETAILS_WIDTH_VAR}, 0px));
  bottom: 16px;
  width: ${FAB_SIZE}px;
  height: ${FAB_SIZE}px;
  pointer-events: auto;
  z-index: 3;
}
[data-layout-control] .dlc-cluster[data-placed] {
  right: auto;
  bottom: auto;
}
[data-layout-control] .dlc-extras {
  position: absolute;
  box-sizing: border-box;
  padding: 10px 12px 12px;
  overflow: auto;
  border-radius: 16px;
  pointer-events: auto;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 88%, transparent);
  border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 10px 28px color-mix(in srgb, var(--dsw-alias-bg-base) 35%, transparent);
}
[data-layout-control] .dlc-extras[data-collapsed] {
  overflow: hidden;
  padding: 6px 10px;
  gap: 0;
}
[data-layout-control] .dlc-extras-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
[data-layout-control] .dlc-extras-head:hover .dlc-extras-kicker {
  color: var(--dsw-alias-label-secondary);
}
[data-layout-control] .dlc-chevron {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  transition: transform 0.15s ease;
}
[data-layout-control] .dlc-chevron.is-up {
  transform: rotate(180deg);
}
[data-layout-control] .dlc-extras-kicker {
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}
[data-layout-control] .dlc-extras-title {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
}
[data-layout-control] .dlc-extras-item {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
[data-layout-control] .dlc-extras-item {
  display: flex;
  gap: 8px;
}
[data-layout-control] .dlc-extras-item b {
  flex: none;
  font-weight: 600;
  color: var(--dsw-alias-label-tertiary);
}
[data-layout-control] .dlc-extras-item span {
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
[data-layout-control] .dlc-extras-rule {
  height: 1px;
  background: var(--dsw-alias-border-l2);
}
[data-layout-control] .dlc-corners {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
[data-layout-control] .dlc-fab,
[data-layout-control] .dlc-close,
[data-layout-control] .dlc-chip,
[data-layout-control] .dlc-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
[data-layout-control] .dlc-fab {
  position: relative;
  z-index: 2;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-button-floating-fill);
  color: var(--dsw-alias-label-secondary);
  cursor: grab;
  touch-action: none;
  transition: transform 0.2s ease, background 0.15s ease, color 0.15s ease;
}
[data-layout-control] .dlc-cluster[data-dragging] .dlc-fab {
  cursor: grabbing;
  transition: none;
}
[data-layout-control] .dlc-cluster[data-peek="left"]:not(:hover):not([data-open]):not([data-dragging]) .dlc-fab {
  transform: translateX(calc(-100% + 18px));
}
[data-layout-control] .dlc-cluster[data-peek="right"]:not(:hover):not([data-open]):not([data-dragging]) .dlc-fab {
  transform: translateX(calc(100% - 18px));
}
[data-layout-control] .dlc-fab:hover,
[data-layout-control] .dlc-fab:focus-visible {
  background: var(--dsw-alias-button-floating-hover);
  color: var(--dsw-alias-label-primary);
}
[data-layout-control] .dlc-panel {
  position: absolute;
  z-index: 1;
  box-sizing: border-box;
  width: 300px;
  max-width: min(300px, calc(100vw - 24px));
  max-height: min(70vh, 560px);
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}
[data-layout-control] .dlc-cluster[data-side="right"] .dlc-panel,
[data-layout-control] .dlc-cluster:not([data-side]) .dlc-panel {
  right: 0;
  left: auto;
}
[data-layout-control] .dlc-cluster[data-side="left"] .dlc-panel {
  left: 0;
  right: auto;
}
[data-layout-control] .dlc-cluster[data-flip="top"] .dlc-panel,
[data-layout-control] .dlc-cluster:not([data-flip]) .dlc-panel {
  bottom: calc(100% + 8px);
  top: auto;
}
[data-layout-control] .dlc-cluster[data-flip="bottom"] .dlc-panel {
  top: calc(100% + 8px);
  bottom: auto;
}
[data-layout-control] .dlc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
[data-layout-control] .dlc-title {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}
[data-layout-control] .dlc-close {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
}
[data-layout-control] .dlc-close:hover,
[data-layout-control] .dlc-close:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}
[data-layout-control] .dlc-presets,
[data-layout-control] .dlc-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
[data-layout-control] .dlc-chip,
[data-layout-control] .dlc-toggle {
  min-height: 28px;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
[data-layout-control] .dlc-chip[aria-pressed="true"],
[data-layout-control] .dlc-toggle[aria-pressed="true"] {
  border-color: var(--dsw-alias-state-business-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, var(--dsw-alias-bg-layer-1));
  color: var(--dsw-alias-state-business-primary);
  font-weight: 600;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent);
}
[data-layout-control] .dlc-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
[data-layout-control] .dlc-section:last-child { margin-bottom: 0; }
[data-layout-control] .dlc-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
[data-layout-control] .dlc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
[data-layout-control] .dlc-row input { margin: 0; }
[data-layout-control] .dlc-details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
[data-layout-control] .dlc-details-row .dlc-row {
  flex: 1;
  min-width: 0;
}
`

    const HIDE_STYLE = [
      `html[${HIDE_ATTR}~="header"] [data-slot="conversation.session.header"] { display: none !important; }`,
      `html[${HIDE_ATTR}~="stats"] [data-slot="conversation.composer.dock"] { display: none !important; }`,
      `html[${HIDE_ATTR}~="dock"] [data-slot="conversation.input.dock"] { display: none !important; }`,
      `html[${HIDE_ATTR}~="overlays"] [data-slot="shell.overlay"] > :not([data-layout-control]) { display: none !important; }`,
      `html[${COMPOSER_ATTR}="hidden"] [data-composer-seat] { display: none !important; }`,
      `html[${COMPOSER_ATTR}="compact"] [data-composer-seat] { --dsh-composer-text-max-height: 72px !important; }`,
      `html[${COMPOSER_ATTR}="compact"] [data-slot="conversation.input.dock"] { display: none !important; }`,
      dockSeat('right'),
      dockSeat('left'),
      `html[${NODE_ATTR}~="user"] [data-chat-flow-kind="user"], html[${NODE_ATTR}~="user"] [data-chat-flow-kind="steering"] { display: none !important; }`,
      `html[${NODE_ATTR}~="think"] [data-chat-block="reasoning"] { display: none !important; }`,
      `html[${NODE_ATTR}~="think"] [data-chat-flow-kind="assistant-step"]:not(:has([data-chat-block="text"])) { display: none !important; }`,
      `html[${NODE_ATTR}~="tools"] [data-chat-flow-kind="tool-call"]:not(:has([data-tool="todo_write"])) { display: none !important; }`,
      `html[${NODE_ATTR}~="todos"] [data-chat-flow-kind="tool-call"]:has([data-tool="todo_write"]) { display: none !important; }`,
      `html[${NODE_ATTR}~="reply"] [data-chat-block="text"] { display: none !important; }`,
      `html[${NODE_ATTR}~="reply"] [data-chat-flow-kind="assistant-step"]:not(:has([data-chat-block="reasoning"])) { display: none !important; }`,
      `html[${NODE_ATTR}~="reply"][${NODE_ATTR}~="think"] [data-chat-flow-kind="assistant-step"] { display: none !important; }`,
      `html[${NODE_ATTR}~="reply"] :is(${REPLY_FLOW}) { display: none !important; }`,
      `html[${AI_ATTR}="hidden"] [data-chat-flow-kind]:not([data-chat-flow-kind="user"]):not([data-chat-flow-kind="steering"]) { display: none !important; }`,
      `html[${AI_ATTR}="hidden"] [data-chat-turn-status] { display: none !important; }`,
      UI_STYLE,
    ].join('\n')

    function installStyle() {
      const style = document.createElement('style')
      style.setAttribute('data-plugin', PLUGIN_ID)
      style.textContent = HIDE_STYLE
      document.head.appendChild(style)
      return () => { style.remove() }
    }

    function edgeOfSeat(seat, clientX) {
      const occupancy = document.documentElement.getAttribute(COMPOSER_ATTR)
      const rect = seat.getBoundingClientRect()
      const edge = occupancy === 'dock-right' ? rect.left : rect.right
      return Math.abs(clientX - edge) <= 8
    }

    function installDockResize() {
      let dragging = false
      let originX = 0
      let originWidth = 0
      let latestX = 0
      let frame = null
      const html = document.documentElement
      const applyDx = (clientX) => {
        const occupancy = html.getAttribute(COMPOSER_ATTR)
        const dx = clientX - originX
        writeDockWidth(occupancy === 'dock-right' ? originWidth - dx : originWidth + dx)
      }
      const onDown = (event) => {
        if (!isComposerDocked() || event.button !== 0) return
        const path = event.composedPath()
        const seat = path.find((node) => node instanceof HTMLElement && node.hasAttribute('data-composer-seat'))
        if (!(seat instanceof HTMLElement) || !edgeOfSeat(seat, event.clientX)) return
        event.preventDefault()
        dragging = true
        originX = event.clientX
        latestX = event.clientX
        originWidth = readDockWidth()
        html.setAttribute('data-dlc-dock-dragging', '')
        if (event.target instanceof HTMLElement) event.target.setPointerCapture?.(event.pointerId)
      }
      const onMove = (event) => {
        if (!dragging) return
        latestX = event.clientX
        if (frame !== null) return
        frame = requestAnimationFrame(() => {
          frame = null
          applyDx(latestX)
        })
      }
      const onUp = () => {
        if (!dragging) return
        dragging = false
        if (frame !== null) {
          cancelAnimationFrame(frame)
          frame = null
        }
        applyDx(latestX)
        html.removeAttribute('data-dlc-dock-dragging')
      }
      window.addEventListener('pointerdown', onDown, true)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      return () => {
        window.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        html.removeAttribute('data-dlc-dock-dragging')
      }
    }

    function installPortHeight() {
      let observed = null
      const write = (el) => {
        const port = Math.round(el.clientHeight)
        if (port < 32) return
        el.style.setProperty(PORT_H_VAR, `${port}px`)
        if (!isComposerDocked()) return
        const seat = el.querySelector('[data-composer-seat]')
        const card = el.querySelector('[data-composer-card]')
        const unit = seat instanceof HTMLElement ? unitBox(seat, card) : undefined
        const unitH = unit === undefined ? 0 : Math.round(unit.bottom - unit.top)
        if (unitH >= 48) el.style.setProperty('--dsh-composer-height', `${unitH}px`)
      }
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target instanceof HTMLElement) write(entry.target)
        }
      })
      const watch = () => {
        const scroll = document.querySelector('[data-conversation-scroll]')
        if (!(scroll instanceof HTMLElement)) return
        if (observed === scroll) {
          write(scroll)
          return
        }
        if (observed !== null) ro.unobserve(observed)
        observed = scroll
        ro.observe(scroll)
        write(scroll)
      }
      const id = window.setInterval(watch, 500)
      watch()
      return () => {
        window.clearInterval(id)
        ro.disconnect()
        observed?.style.removeProperty(PORT_H_VAR)
      }
    }

    function installDetailsWidth() {
      let observed = null
      let last = ''
      const write = () => {
        const details = document.querySelector('[data-slot="details"]')
        const width = details?.parentElement?.getBoundingClientRect().width ?? 0
        const next = `${Math.max(0, Math.round(width))}px`
        if (next === last) return
        last = next
        document.documentElement.style.setProperty(DETAILS_WIDTH_VAR, next)
      }
      const ro = new ResizeObserver(write)
      const watch = () => {
        const frame = document.querySelector('[data-shell-overlay]')?.parentElement
        if (frame === null || frame === undefined) return
        if (observed === frame) {
          write()
          return
        }
        if (observed !== null) ro.unobserve(observed)
        observed = frame
        ro.observe(frame)
        write()
      }
      const id = window.setInterval(watch, 1000)
      watch()
      return () => {
        window.clearInterval(id)
        ro.disconnect()
        document.documentElement.style.removeProperty(DETAILS_WIDTH_VAR)
      }
    }

    function applySidebar(mode, layout) {
      try {
        if (mode === 'hidden') layout.setSidebarHidden(true)
        else {
          layout.setSidebarHidden(false)
          layout.setSidebarOpen(mode === 'expanded')
        }
      } catch {
        // Panel actions throw when the root entry is unwired.
      }
    }

    function applyView(view) {
      writeHideAttribute(hiddenOf(view.chrome, CHROME_IDS))
      writeComposerAttribute(view.composer)
      writeCardAlign(view.cardAlign)
      writeNodeAttribute(hiddenOf(view.nodes, NODE_IDS))
    }

    function clipText(el) {
      if (!(el instanceof HTMLElement)) return ''
      return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 140)
    }

    function unionBoxes(boxes) {
      if (boxes.length === 0) return undefined
      const top = Math.min(...boxes.map((box) => box.top))
      const bottom = Math.max(...boxes.map((box) => box.bottom))
      const left = Math.min(...boxes.map((box) => box.left))
      const right = Math.max(...boxes.map((box) => box.left + box.width))
      return { top, bottom, left, width: right - left }
    }

    function clientBox(el) {
      if (!(el instanceof HTMLElement)) return undefined
      if (getComputedStyle(el).display === 'contents') {
        return unionBoxes([...el.children].map(clientBox).filter((box) => box !== undefined))
      }
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return undefined
      return { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width }
    }

    function unitBox(seat, card) {
      return unionBoxes([
        clientBox(card),
        clientBox(card?.parentElement),
        clientBox(seat.querySelector('[data-slot="conversation.input.dock"]')),
        clientBox(seat.querySelector('[data-slot="conversation.composer.dock"]')),
      ].filter((box) => box !== undefined))
    }

    function extrasSnapshot() {
      const users = document.querySelectorAll('[data-chat-flow-kind="user"]')
      const replies = document.querySelectorAll('[data-chat-block="text"]')
      return {
        title: clipText(document.querySelector('[data-slot="conversation.session.header"]')),
        lastUser: clipText(users[users.length - 1]),
        lastReply: clipText(replies[replies.length - 1]),
      }
    }

    function measureExtras(collapsed) {
      const root = document.querySelector('[data-layout-control]')
      const seat = document.querySelector('[data-composer-seat]')
      const card = document.querySelector('[data-composer-card]')
      if (root === null || seat === null || !isComposerDocked()) return null
      const scroll = seat.parentElement
      if (!(scroll instanceof HTMLElement)) return null
      const origin = root.getBoundingClientRect()
      const port = scroll.getBoundingClientRect()
      const box = seat.getBoundingClientRect()
      const unit = unitBox(seat, card)
      const align = document.documentElement.getAttribute(ALIGN_ATTR) === 'top' ? 'top' : 'bottom'
      const gap = 8
      const collapsedH = 36
      let top
      let height
      if (unit === undefined) {
        top = port.top - origin.top + gap
        height = port.height - gap * 2
      } else if (align === 'top') {
        top = unit.bottom - origin.top + gap
        height = port.bottom - unit.bottom - gap * 2
      } else {
        top = port.top - origin.top + gap
        height = unit.top - port.top - gap * 2
      }
      if (height < 36) return null
      if (collapsed) {
        height = collapsedH
        if (align === 'bottom') {
          top = (unit === undefined ? port.bottom : unit.top) - origin.top - gap - collapsedH
        }
      }
      const bits = extrasSnapshot()
      return {
        align,
        style: {
          top: `${Math.round(top)}px`,
          left: `${Math.round(box.left - origin.left + 10)}px`,
          width: `${Math.round(Math.max(0, box.width - 20))}px`,
          height: `${Math.round(height)}px`,
        },
        ...bits,
      }
    }

    function loadFabPos() {
      try {
        const raw = sessionStorage.getItem(FAB_KEY)
        if (raw === null) return null
        const parsed = JSON.parse(raw)
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed
      } catch {
        // Storage may be blocked.
      }
      return null
    }

    function saveFabPos(pos) {
      try {
        sessionStorage.setItem(FAB_KEY, JSON.stringify(pos))
      } catch {
        // Storage may be blocked.
      }
    }

    function overlaySize(root) {
      const box = root.getBoundingClientRect()
      return { width: box.width, height: box.height }
    }

    function defaultFabPos(root) {
      const { width, height } = overlaySize(root)
      const details = Number.parseFloat(
        document.documentElement.style.getPropertyValue(DETAILS_WIDTH_VAR),
      )
      const inset = Number.isFinite(details) ? details : 0
      return {
        x: Math.max(0, width - FAB_SIZE - FAB_MARGIN - inset),
        y: Math.max(0, height - FAB_SIZE - FAB_MARGIN),
      }
    }

    function clampFab(x, y, width, height) {
      return {
        x: Math.min(Math.max(0, x), Math.max(0, width - FAB_SIZE)),
        y: Math.min(Math.max(0, y), Math.max(0, height - FAB_SIZE)),
      }
    }

    function snapFab(x, y, width, height) {
      const clamped = clampFab(x, y, width, height)
      const mid = width / 2
      return {
        x: clamped.x + FAB_SIZE / 2 < mid ? 0 : Math.max(0, width - FAB_SIZE),
        y: clamped.y,
      }
    }

    function peekSideOf(x, width) {
      if (x <= 2) return 'left'
      if (x >= width - FAB_SIZE - 2) return 'right'
      return ''
    }

    function tryClearDetails() {
      document.dispatchEvent(new Event(DETAILS_CLEAR_EVENT))
      const details = document.querySelector('[data-slot="details"]')
      if (details === null) return
      const named = details.querySelector(
        '[data-details-clear], [aria-label*="清空"], [aria-label*="Clear" i]',
      )
      if (named instanceof HTMLElement) named.click()
    }

    function IconLayout() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', { fill: 'currentColor', d: 'M1.5 2.5h13v11h-13v-11zm1.5 1.5v8h3.5v-8H3zm5 0v4.5H13V4H8zm0 6V12H13V10H8z' }),
      )
    }

    function IconClose() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', { fill: 'currentColor', d: 'M3.2 3.2 8 8l4.8-4.8 1.2 1.2L9.2 9.2l4.8 4.8-1.2 1.2L8 10.4l-4.8 4.8-1.2-1.2 4.8-4.8-4.8-4.8z' }),
      )
    }

    function IconChevron({ up }) {
      return h('svg', {
        className: up ? 'dlc-chevron is-up' : 'dlc-chevron',
        width: 12,
        height: 12,
        viewBox: '0 0 12 12',
        'aria-hidden': true,
      },
        h('path', { fill: 'currentColor', d: 'M2.2 4.2 6 8l3.8-3.8L11 5.4 6 10.4 1 5.4z' }),
      )
    }

    function pressedClass(pressed) {
      return pressed ? 'dlc-chip' : 'dlc-chip'
    }

    function LayoutControlPanel({ setSidebarHidden, setSidebarOpen, setDetailsOpen }) {
      const [open, setOpen] = React.useState(false)
      const [view, setView] = React.useState(() => cloneState(PRESETS.default))
      const [aiVisible, setAiVisible] = React.useState(true)
      const [extras, setExtras] = React.useState(null)
      const [sessionOpen, setSessionOpen] = React.useState(true)
      const [fab, setFab] = React.useState(() => loadFabPos())
      const [dragging, setDragging] = React.useState(false)
      const [overlayBox, setOverlayBox] = React.useState({ width: 0, height: 0 })
      const dragRef = React.useRef(null)
      const layout = { setSidebarHidden, setSidebarOpen, setDetailsOpen }
      const preset = matchingPreset(view)
      const sideDock = view.composer === 'dock-left' || view.composer === 'dock-right'

      React.useEffect(() => { applyView(view) }, [view])

      React.useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('keydown', onKey) }
      }, [open])

      React.useEffect(() => {
        if (!sideDock) {
          setExtras(null)
          return undefined
        }
        let frame = 0
        const tick = () => {
          const next = measureExtras(!sessionOpen)
          setExtras((current) => {
            const same = JSON.stringify(current) === JSON.stringify(next)
            return same ? current : next
          })
          frame = window.setTimeout(tick, 250)
        }
        tick()
        return () => { window.clearTimeout(frame) }
      }, [sideDock, sessionOpen, view.cardAlign, view.composer])

      React.useEffect(() => {
        const place = () => {
          const root = document.querySelector('[data-layout-control]')
          if (!(root instanceof HTMLElement)) return
          const { width, height } = overlaySize(root)
          setOverlayBox({ width, height })
          setFab((current) => {
            const next = clampFab(
              (current ?? defaultFabPos(root)).x,
              (current ?? defaultFabPos(root)).y,
              width,
              height,
            )
            if (current !== null && current.x === next.x && current.y === next.y) return current
            return next
          })
        }
        place()
        window.addEventListener('resize', place)
        return () => { window.removeEventListener('resize', place) }
      }, [])

      React.useEffect(() => {
        if (!dragging) return undefined
        const onMove = (event) => {
          const drag = dragRef.current
          const root = document.querySelector('[data-layout-control]')
          if (drag === null || !(root instanceof HTMLElement)) return
          const { width, height } = overlaySize(root)
          drag.moved = drag.moved
            || Math.abs(event.clientX - drag.startX) > 4
            || Math.abs(event.clientY - drag.startY) > 4
          if (!drag.moved) return
          const origin = root.getBoundingClientRect()
          const next = clampFab(
            event.clientX - origin.left - drag.offsetX,
            event.clientY - origin.top - drag.offsetY,
            width,
            height,
          )
          setOverlayBox({ width, height })
          setFab(next)
        }
        const onUp = () => {
          const drag = dragRef.current
          const root = document.querySelector('[data-layout-control]')
          setDragging(false)
          if (drag === null || !(root instanceof HTMLElement)) return
          const { width, height } = overlaySize(root)
          setOverlayBox({ width, height })
          if (drag.moved) {
            setFab((current) => {
              const next = snapFab((current ?? defaultFabPos(root)).x, (current ?? defaultFabPos(root)).y, width, height)
              saveFabPos(next)
              return next
            })
          }
          dragRef.current = drag.moved ? { ...drag, done: true } : null
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        return () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
        }
      }, [dragging])

      const chooseSidebar = (mode) => {
        setView((current) => ({ ...current, sidebar: mode }))
        applySidebar(mode, layout)
      }
      const chooseDetails = (next) => {
        setView((current) => ({ ...current, details: next }))
        try { setDetailsOpen(next) } catch { /* root unwired */ }
      }
      const choosePreset = (id) => {
        const next = cloneState(PRESETS[id])
        setView(next)
        applySidebar(next.sidebar, layout)
        try { setDetailsOpen(next.details) } catch { /* root unwired */ }
      }
      const chooseComposer = (mode) => {
        setView((current) => ({ ...current, composer: mode }))
      }
      const chooseCorner = (side, align) => {
        setView((current) => ({ ...current, composer: side, cardAlign: align }))
      }
      const chooseChrome = (id, visible) => {
        setView((current) => ({ ...current, chrome: { ...current.chrome, [id]: visible } }))
      }
      const chooseNode = (id, visible) => {
        setView((current) => ({ ...current, nodes: { ...current.nodes, [id]: visible } }))
      }

      const title = extras?.title ?? ''
      const extrasAlign = extras?.align ?? view.cardAlign
      const chevronUp = extrasAlign === 'bottom' ? sessionOpen : !sessionOpen
      const placed = fab !== null
      const clusterSide = placed && overlayBox.width > 0 && fab.x + FAB_SIZE / 2 < overlayBox.width / 2 ? 'left' : 'right'
      const spaceBelow = overlayBox.height - (fab?.y ?? 0) - FAB_SIZE
      const clusterFlip = placed && spaceBelow >= Math.min(280, fab.y) ? 'bottom' : 'top'
      const peek = placed ? peekSideOf(fab.x, overlayBox.width || FAB_SIZE * 2) : ''
      const clusterStyle = placed
        ? { left: `${Math.round(fab.x)}px`, top: `${Math.round(fab.y)}px` }
        : undefined

      return h('div', { 'data-layout-control': '' },
        extras !== null && h('div', {
          className: 'dlc-extras',
          'data-collapsed': sessionOpen ? undefined : '',
          'data-align': extrasAlign,
          style: extras.style,
        },
          h('button', {
            type: 'button',
            className: 'dlc-extras-head',
            'aria-expanded': sessionOpen,
            'aria-label': sessionOpen ? t('extras.fold') : t('extras.expand'),
            onClick: () => { setSessionOpen((value) => !value) },
          },
            h('span', { className: 'dlc-extras-kicker' }, t('extras.session')),
            h(IconChevron, { up: chevronUp }),
          ),
          sessionOpen && title !== '' && h('div', { className: 'dlc-extras-title' }, title),
          sessionOpen && (extras.lastUser !== '' || extras.lastReply !== '') && h('div', { className: 'dlc-extras-rule' }),
          sessionOpen && (extras.lastUser !== '' || extras.lastReply !== '') && h('div', { className: 'dlc-extras-kicker' }, t('extras.recent')),
          sessionOpen && extras.lastUser !== '' && h('div', { className: 'dlc-extras-item' },
            h('b', null, t('extras.you')),
            h('span', null, extras.lastUser),
          ),
          sessionOpen && extras.lastReply !== '' && h('div', { className: 'dlc-extras-item' },
            h('b', null, t('extras.assistant')),
            h('span', null, extras.lastReply),
          ),
        ),
        h('div', {
          className: 'dlc-cluster',
          'data-placed': placed ? '' : undefined,
          'data-side': clusterSide,
          'data-flip': clusterFlip,
          'data-peek': peek === '' ? undefined : peek,
          'data-open': open ? '' : undefined,
          'data-dragging': dragging ? '' : undefined,
          style: clusterStyle,
        },
        open && h('div', { className: 'dlc-panel', role: 'dialog', 'aria-label': t('panel.title') },
          h('div', { className: 'dlc-header' },
            h('span', { className: 'dlc-title' }, t('panel.title')),
            h('button', {
              type: 'button',
              className: 'dlc-close',
              onClick: () => { setOpen(false) },
              'aria-label': t('toggle.close'),
            }, h(IconClose)),
          ),
          h('div', { className: 'dlc-presets' },
            PRESET_IDS.map((id) => h('button', {
              key: id,
              type: 'button',
              className: pressedClass(preset === id),
              'aria-pressed': preset === id,
              onClick: () => { choosePreset(id) },
            }, t(`preset.${id}`))),
          ),
          h('div', { className: 'dlc-section' },
            h('span', { className: 'dlc-label' }, t('sidebar.label')),
            h('div', { className: 'dlc-modes' },
              SIDEBAR_MODES.map((mode) => h('button', {
                key: mode,
                type: 'button',
                className: 'dlc-toggle',
                'aria-pressed': view.sidebar === mode,
                onClick: () => { chooseSidebar(mode) },
              }, t(`sidebar.${mode}`))),
            ),
          ),
          h('div', { className: 'dlc-section' },
            h('span', { className: 'dlc-label' }, t('composer.label')),
            h('div', { className: 'dlc-modes' },
              COMPOSER_MODES.map((mode) => h('button', {
                key: mode,
                type: 'button',
                className: 'dlc-toggle',
                'aria-pressed': view.composer === mode,
                onClick: () => { chooseComposer(mode) },
              }, t(`composer.${mode}`))),
            ),
            h('span', { className: 'dlc-label' }, t('composer.corner')),
            h('div', { className: 'dlc-corners' },
              DOCK_CORNERS.map((corner) => h('button', {
                key: corner.id,
                type: 'button',
                className: 'dlc-toggle',
                'aria-pressed': view.composer === corner.side && view.cardAlign === corner.align,
                onClick: () => { chooseCorner(corner.side, corner.align) },
              }, t(`composer.${corner.id}`))),
            ),
          ),
          h('div', { className: 'dlc-details-row' },
            h('label', { className: 'dlc-row' },
              h('input', {
                type: 'checkbox',
                checked: view.details,
                onChange: (event) => { chooseDetails(event.target.checked) },
              }),
              t('details.label'),
            ),
            h('button', {
              type: 'button',
              className: 'dlc-toggle',
              onClick: () => { tryClearDetails() },
            }, t('details.clear')),
          ),
          h('div', { className: 'dlc-section' },
            CHROME_IDS.map((id) => h('label', { key: id, className: 'dlc-row' },
              h('input', {
                type: 'checkbox',
                checked: view.chrome[id],
                onChange: (event) => { chooseChrome(id, event.target.checked) },
              }),
              t(`chrome.${id}`),
            )),
          ),
          h('div', { className: 'dlc-section' },
            h('span', { className: 'dlc-label' }, t('nodes.label')),
            h('label', { className: 'dlc-row' },
              h('input', {
                type: 'checkbox',
                checked: aiVisible,
                onChange: (event) => {
                  const next = event.target.checked
                  setAiVisible(next)
                  writeAiAttribute(!next)
                },
              }),
              t('nodes.ai'),
            ),
            NODE_IDS.map((id) => h('label', { key: id, className: 'dlc-row' },
              h('input', {
                type: 'checkbox',
                checked: view.nodes[id],
                onChange: (event) => { chooseNode(id, event.target.checked) },
              }),
              t(`nodes.${id}`),
            )),
          ),
        ),
        h('button', {
          type: 'button',
          className: 'dlc-fab',
          'aria-expanded': open,
          'aria-label': t('toggle.open'),
          onPointerDown: (event) => {
            if (event.button !== 0) return
            const root = document.querySelector('[data-layout-control]')
            if (!(root instanceof HTMLElement) || !(event.currentTarget instanceof HTMLElement)) return
            const origin = root.getBoundingClientRect()
            const box = event.currentTarget.getBoundingClientRect()
            dragRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              offsetX: event.clientX - box.left,
              offsetY: event.clientY - box.top,
              moved: false,
              done: false,
            }
            setDragging(true)
            event.currentTarget.setPointerCapture?.(event.pointerId)
          },
          onClick: (event) => {
            const drag = dragRef.current
            if (drag?.moved || drag?.done) {
              event.preventDefault()
              dragRef.current = null
              return
            }
            dragRef.current = null
            setOpen((value) => !value)
          },
        }, h(IconLayout)),
        ),
      )
    }

    function apply(ctx) {
      ctx.effect(() => installStyle(), 'dsh-layout-control: stylesheet')
      ctx.effect(() => installDockResize(), 'dsh-layout-control: dock resize')
      ctx.effect(() => installPortHeight(), 'dsh-layout-control: scrollport height')
      ctx.effect(() => installDetailsWidth(), 'dsh-layout-control: details width')
      ctx.effect(() => () => {
        try {
          ctx.layout.setSidebarHidden(false)
        } catch {
          // Root entry already unmounted; panel actions throw when unwired.
        }
        clearAttributes()
      }, 'dsh-layout-control: restore occupancy')

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: PLUGIN_ID,
        order: 1000,
        inject: () => ({
          setSidebarHidden: (hidden) => { ctx.layout.setSidebarHidden(hidden) },
          setSidebarOpen: (open) => { ctx.layout.setSidebarOpen(open) },
          setDetailsOpen: (open) => { ctx.layout.setDetailsOpen(open) },
        }),
      }, LayoutControlPanel))
    }

    exports.isPlugin = true
    exports.inject = ['layout', 'slots']
    exports.apply = apply
    return module.exports
  },
})
