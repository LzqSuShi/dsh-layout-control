/**
 * dsh-layout-control — DeepSeek Harness Web layout overlay (browser half).
 *
 * 1. window.__ModuleLoader__.load() registers this package as a client module.
 * 2. Exports { isPlugin, inject: ["layout", "slots"], apply }.
 * 3. apply(ctx) registers a shell.overlay React entry and installs a
 *    stylesheet that targets public [data-slot] / [data-composer-seat] /
 *    [data-chat-flow-kind] anchors. Column occupancy goes through ctx.layout.
 * 4. Docking the composer is CSS grid on the stock conversation scrollport;
 *    a MutationObserver injects a resize handle (no harness source changes).
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
    const DETAILS_WIDTH_VAR = '--dsh-layout-control-details-width'
    const DOCK_WIDTH_VAR = '--dsh-composer-dock-width'
    const DOCK_MIN = 280
    const DOCK_MAX = 560
    const DOCK_DEFAULT = 360
    const DETAILS_CLEAR_EVENT = 'dsh-details-clear'

    const CHROME_IDS = ['header', 'stats', 'dock', 'overlays']
    const COMPOSER_MODES = ['full', 'compact', 'dock-right', 'dock-left', 'hidden']
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
      'composer.dock-right': '右侧',
      'composer.dock-left': '左侧',
      'composer.hidden': '不显示',
      'composer.resize': '调整输入栏宽度',
      'composer.dock-hint': '拖动内侧边缘可调整宽度',
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
      'composer.dock-right': 'Right',
      'composer.dock-left': 'Left',
      'composer.hidden': 'Off',
      'composer.resize': 'Resize composer',
      'composer.dock-hint': 'Drag the inner edge to resize',
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
        chrome: { ...VISIBLE_CHROME },
        nodes: { ...VISIBLE_NODES },
      },
      focus: {
        sidebar: 'rail',
        details: false,
        composer: 'dock-right',
        chrome: { header: true, stats: false, dock: true, overlays: false },
        nodes: { ...VISIBLE_NODES },
      },
      zen: {
        sidebar: 'hidden',
        details: false,
        composer: 'dock-right',
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
      el.removeAttribute(NODE_ATTR)
      el.removeAttribute(AI_ATTR)
      el.style.removeProperty(DOCK_WIDTH_VAR)
      el.style.removeProperty(DETAILS_WIDTH_VAR)
    }

    function dockSeat(side) {
      const attr = side === 'right' ? 'dock-right' : 'dock-left'
      const width = `var(${DOCK_WIDTH_VAR}, ${DOCK_DEFAULT}px)`
      const columns = side === 'right'
        ? `minmax(0, 1fr) ${width}`
        : `${width} minmax(0, 1fr)`
      const seatCol = side === 'right' ? '2' : '1'
      const sessionCol = side === 'right' ? '1' : '2'
      const handleEdge = side === 'right' ? 'left' : 'right'
      const prefix = `html[${COMPOSER_ATTR}="${attr}"]`
      const scroll = `${prefix} :is([data-phase="active"], [data-phase="settling"]) > [data-conversation-scroll]:not(:has([data-conversation-composer-overlay]))`
      return [
        `${prefix} [data-phase="settling"] [data-composer-seat] { visibility: visible !important; }`,
        `${scroll} { display: grid !important; grid-template-columns: ${columns}; grid-template-rows: minmax(0, 1fr); overflow: hidden !important; align-items: stretch; }`,
        `${scroll} > :is([data-conversation-transcript], [data-slot="conversation.session"]) { min-width: 0; min-height: 0; overflow-y: auto; grid-column: ${sessionCol}; grid-row: 1; }`,
        `${scroll} > [data-composer-seat] { position: relative !important; grid-column: ${seatCol}; grid-row: 1; height: 100%; min-height: 0; overflow: hidden; display: flex !important; flex-direction: column; justify-content: stretch; background: var(--dsw-alias-bg-base); z-index: 1; padding: 0; --dsh-composer-card-max-width: 100%; --dsh-composer-side-clearance: 8px; --dsh-composer-text-max-height: 140px; --dsh-chat-content-width: 100%; }`,
        `${prefix} [data-composer-pane] { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 12px 16px 8px; }`,
        `${prefix} [data-composer-pane-title] { font-size: 15px; line-height: 22px; font-weight: 600; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
        `${prefix} [data-composer-pane-meta] { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
        `${prefix} [data-composer-seat] > :not([data-composer-dock-handle]):not([data-composer-pane]) { flex: none; display: flex; flex-direction: column; padding: 0 8px 8px; }`,
        `${prefix} [data-composer-card] { max-width: 100%; }`,
        `${prefix} [data-slot="conversation.input.model"] { max-width: 100%; }`,
        `${prefix} [data-slot="conversation.input.dock"] { max-height: 28vh; overflow-y: auto; }`,
        `${prefix} [data-chat-to-bottom] { bottom: 16px !important; }`,
        `${prefix} [data-composer-dock-handle] { position: absolute; top: 0; bottom: 0; ${handleEdge}: 0; width: 8px; z-index: 4; cursor: col-resize; }`,
        `${prefix} [data-composer-dock-handle]:hover, ${prefix} [data-composer-dock-handle][data-dragging] { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent); }`,
      ].join('\n')
    }

    const UI_STYLE = `
[data-layout-control] {
  position: absolute;
  right: calc(16px + var(${DETAILS_WIDTH_VAR}, 0px));
  bottom: 16px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: auto;
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
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-button-floating-fill);
  color: var(--dsw-alias-label-secondary);
}
[data-layout-control] .dlc-fab:hover,
[data-layout-control] .dlc-fab:focus-visible {
  background: var(--dsw-alias-button-floating-hover);
  color: var(--dsw-alias-label-primary);
}
[data-layout-control] .dlc-panel {
  box-sizing: border-box;
  width: 300px;
  max-height: min(70vh, 560px);
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
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

    function headerTitle() {
      const header = document.querySelector('[data-slot="conversation.session.header"]')
      if (header === null) return ''
      const text = (header.textContent ?? '').replace(/\s+/g, ' ').trim()
      return text
    }

    function bindHandle(handle) {
      let originX = 0
      let originWidth = 0
      let latestX = 0
      let frame = null
      const applyDx = (clientX) => {
        const occupancy = document.documentElement.getAttribute(COMPOSER_ATTR)
        const dx = clientX - originX
        writeDockWidth(occupancy === 'dock-right' ? originWidth - dx : originWidth + dx)
      }
      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        handle.setPointerCapture(event.pointerId)
        originX = event.clientX
        latestX = event.clientX
        originWidth = readDockWidth()
        handle.setAttribute('data-dragging', '')
      })
      handle.addEventListener('pointermove', (event) => {
        if (!handle.hasPointerCapture(event.pointerId)) return
        latestX = event.clientX
        if (frame !== null) return
        frame = requestAnimationFrame(() => {
          frame = null
          applyDx(latestX)
        })
      })
      const end = (event) => {
        if (!handle.hasPointerCapture(event.pointerId)) return
        handle.releasePointerCapture(event.pointerId)
        if (frame !== null) {
          cancelAnimationFrame(frame)
          frame = null
        }
        applyDx(latestX)
        handle.removeAttribute('data-dragging')
      }
      handle.addEventListener('pointerup', end)
      handle.addEventListener('pointercancel', end)
    }

    function decorateSeat(seat) {
      if (seat.querySelector('[data-dlc-chrome]')) return
      const handle = document.createElement('div')
      handle.setAttribute('data-composer-dock-handle', '')
      handle.setAttribute('data-dlc-chrome', '')
      handle.setAttribute('role', 'separator')
      handle.setAttribute('aria-orientation', 'vertical')
      handle.setAttribute('aria-label', t('composer.resize'))
      handle.title = t('composer.dock-hint')
      const pane = document.createElement('div')
      pane.setAttribute('data-composer-pane', '')
      pane.setAttribute('data-dlc-chrome', '')
      const title = document.createElement('div')
      title.setAttribute('data-composer-pane-title', '')
      pane.appendChild(title)
      seat.prepend(pane)
      seat.prepend(handle)
      bindHandle(handle)
    }

    function syncPaneTitles() {
      const title = headerTitle()
      for (const node of document.querySelectorAll('[data-composer-pane-title]')) {
        if (title === '') node.remove()
        else {
          node.textContent = title
          if (node.parentElement === null) continue
        }
      }
      if (title === '') return
      for (const pane of document.querySelectorAll('[data-composer-pane]')) {
        if (pane.querySelector('[data-composer-pane-title]')) continue
        const node = document.createElement('div')
        node.setAttribute('data-composer-pane-title', '')
        node.textContent = title
        pane.prepend(node)
      }
    }

    function stripChrome() {
      for (const node of document.querySelectorAll('[data-dlc-chrome]')) node.remove()
    }

    function syncDockChrome() {
      if (!isComposerDocked()) {
        stripChrome()
        return
      }
      for (const seat of document.querySelectorAll('[data-composer-seat]')) decorateSeat(seat)
      syncPaneTitles()
    }

    function installDockChrome() {
      const observer = new MutationObserver(syncDockChrome)
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: [COMPOSER_ATTR],
      })
      syncDockChrome()
      return () => {
        observer.disconnect()
        stripChrome()
      }
    }

    function installDetailsWidth() {
      let observer = null
      const attach = () => {
        observer?.disconnect()
        observer = null
        const details = document.querySelector('[data-slot="details"]')
        const target = details?.parentElement
        if (target === null || target === undefined) {
          document.documentElement.style.setProperty(DETAILS_WIDTH_VAR, '0px')
          return
        }
        const write = () => {
          document.documentElement.style.setProperty(
            DETAILS_WIDTH_VAR,
            `${Math.max(0, Math.round(target.getBoundingClientRect().width))}px`,
          )
        }
        observer = new ResizeObserver(write)
        observer.observe(target)
        write()
      }
      const tree = new MutationObserver(attach)
      tree.observe(document.body, { subtree: true, childList: true })
      attach()
      return () => {
        tree.disconnect()
        observer?.disconnect()
        document.documentElement.style.removeProperty(DETAILS_WIDTH_VAR)
      }
    }

    function applySidebar(mode, layout) {
      if (mode === 'hidden') layout.setSidebarHidden(true)
      else {
        layout.setSidebarHidden(false)
        layout.setSidebarOpen(mode === 'expanded')
      }
    }

    function applyView(view) {
      writeHideAttribute(hiddenOf(view.chrome, CHROME_IDS))
      writeComposerAttribute(view.composer)
      writeNodeAttribute(hiddenOf(view.nodes, NODE_IDS))
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

    function pressedClass(pressed) {
      return pressed ? 'dlc-chip' : 'dlc-chip'
    }

    function LayoutControlPanel({ setSidebarHidden, setSidebarOpen, setDetailsOpen }) {
      const [open, setOpen] = React.useState(false)
      const [view, setView] = React.useState(() => cloneState(PRESETS.default))
      const [aiVisible, setAiVisible] = React.useState(true)
      const layout = { setSidebarHidden, setSidebarOpen, setDetailsOpen }
      const preset = matchingPreset(view)

      React.useEffect(() => { applyView(view) }, [view])

      React.useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('keydown', onKey) }
      }, [open])

      const chooseSidebar = (mode) => {
        setView((current) => ({ ...current, sidebar: mode }))
        applySidebar(mode, layout)
      }
      const chooseDetails = (next) => {
        setView((current) => ({ ...current, details: next }))
        setDetailsOpen(next)
      }
      const choosePreset = (id) => {
        const next = cloneState(PRESETS[id])
        setView(next)
        applySidebar(next.sidebar, layout)
        setDetailsOpen(next.details)
      }
      const chooseComposer = (mode) => {
        setView((current) => ({ ...current, composer: mode }))
      }
      const chooseChrome = (id, visible) => {
        setView((current) => ({ ...current, chrome: { ...current.chrome, [id]: visible } }))
      }
      const chooseNode = (id, visible) => {
        setView((current) => ({ ...current, nodes: { ...current.nodes, [id]: visible } }))
      }

      return h('div', { 'data-layout-control': '' },
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
          onClick: () => { setOpen((value) => !value) },
        }, h(IconLayout)),
      )
    }

    function apply(ctx) {
      ctx.effect(() => installStyle(), 'dsh-layout-control: stylesheet')
      ctx.effect(() => installDockChrome(), 'dsh-layout-control: dock chrome')
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
