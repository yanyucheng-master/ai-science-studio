/* 下拉菜单统一样式（2026-11-07）
   给原生 <select> 加 data-menu-select 即启用：原生 select 保留（同 id、同 option、同 value、原有监听器），作为数据源视觉隐藏；
   其后追加一个触发按钮和 role="listbox" 的弹出列表，样式与 AI 问答“更多”菜单一致。
   - 面板选择 → 写回原生 select 并派发 input / change（值没变不派发）。
   - 原生 select 被程序赋值（.value / .selectedIndex）、收到 input / change → 同步按钮文字与选中项；打开面板时再同步一次。
   - 定位为同步计算，不申请动画帧；鸿蒙兼容模式（body.harmony-compat-mode）不增强，保持原生 select。 */
(() => {
  "use strict";

  const doc = document;
  const body = doc.body;
  const compat = () => body.classList.contains("harmony-compat-mode");
  const GAP = 6;      // 面板与按钮的间距（同“更多”菜单）
  const EDGE = 4;     // 面板与视口/裁切容器边缘保留的距离
  const MIN_HEIGHT = 52;    // 空间极小时至少露出一个选项（面板内边距 + 一行 38px）
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const nativeIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  const instances = [];
  let current = null;
  let uid = 0;

  const nextId = prefix => {
    let id;
    do { id = `${prefix}-${++uid}`; } while (doc.getElementById(id));
    return id;
  };
  const optionText = option => (option.label || option.textContent || "").trim();
  const ensureId = (node, prefix) => {
    if (!node.id) node.id = nextId(prefix);
    return node.id;
  };

  // 名称取原 label：label 包着 select 时取其中的文字节点（如“回答方式”的视觉隐藏文字），否则取 label 本身
  function nameSource(select) {
    const label = select.labels?.[0];
    if (!label) return null;
    if (!label.contains(select)) return label;
    return [...label.children].find(node => node !== select && !node.contains(select) && !node.classList.contains("menu-select") && node.textContent.trim()) || null;
  }

  // 裁切边界：视口与所有 overflow 不为 visible 的祖先可见区域的交集（个人密钥弹窗 overflow-y:auto、AI 小窗 overflow:hidden）
  function clipBounds(node) {
    const bounds = { top: 0, left: 0, right: doc.documentElement.clientWidth || window.innerWidth, bottom: window.innerHeight };
    for (let el = node.parentElement; el && el !== body && el !== doc.documentElement; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      const rect = el.getBoundingClientRect();
      const top = rect.top + el.clientTop;
      const left = rect.left + el.clientLeft;
      bounds.top = Math.max(bounds.top, top);
      bounds.left = Math.max(bounds.left, left);
      bounds.bottom = Math.min(bounds.bottom, top + el.clientHeight);
      bounds.right = Math.min(bounds.right, left + el.clientWidth);
    }
    return bounds;
  }

  function enhance(select) {
    if (!(select instanceof HTMLSelectElement) || select.multiple || select.size > 1 || select.dataset.menuSelectReady) return null;
    select.dataset.menuSelectReady = "true";
    const baseId = select.id || nextId("menu-select");
    const originalTabindex = select.getAttribute("tabindex");
    const originalHidden = select.getAttribute("aria-hidden");

    const wrapper = doc.createElement("span");
    wrapper.className = "menu-select";
    const trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.className = "menu-select-trigger";
    trigger.dataset.menuSelectTrigger = "";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const text = doc.createElement("span");
    text.className = "menu-select-text";
    const value = doc.createElement("span");
    value.className = "menu-select-value";
    value.id = nextId(`${baseId}-menu-value`);
    text.append(value);
    trigger.append(text);
    trigger.insertAdjacentHTML("beforeend", '<svg class="menu-select-arrow" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="m2 3.5 3 3 3-3"/></svg>');
    const panel = doc.createElement("div");
    panel.className = "menu-select-panel";
    panel.id = nextId(`${baseId}-menu`);
    panel.setAttribute("role", "listbox");
    panel.tabIndex = -1;
    panel.hidden = true;
    trigger.setAttribute("aria-controls", panel.id);
    wrapper.append(trigger, panel);
    select.after(wrapper);

    const source = nameSource(select);
    const labelText = source?.textContent.trim() || select.getAttribute("aria-label") || select.title || "";
    if (source) {
      trigger.setAttribute("aria-labelledby", `${ensureId(source, `${baseId}-menu-label`)} ${value.id}`);
      panel.setAttribute("aria-labelledby", source.id);
    } else if (labelText) {
      trigger.setAttribute("aria-label", labelText);
      panel.setAttribute("aria-label", labelText);
    }

    let items = [];
    let activeIndex = -1;
    let isOpen = false;
    let anchorTop = 0;
    let anchorWidth = 0;
    let hiddenAtOpen = false;
    let observer = null;

    function build() {
      const options = [...select.options];
      text.querySelectorAll(".menu-select-sizer").forEach(node => node.remove());
      for (const option of options) {
        const sizer = doc.createElement("span");
        sizer.className = "menu-select-sizer";
        sizer.setAttribute("aria-hidden", "true");
        sizer.textContent = optionText(option);
        text.append(sizer);
      }
      panel.replaceChildren();
      items = options.map((option, index) => {
        const item = doc.createElement("div");
        item.className = "menu-select-option";
        item.id = `${panel.id}-option-${index}`;
        item.setAttribute("role", "option");
        item.dataset.index = String(index);
        item.textContent = optionText(option);
        if (option.disabled) item.setAttribute("aria-disabled", "true");
        panel.append(item);
        return item;
      });
      sync();
    }

    function sync() {
      const index = nativeIndex.get.call(select);
      const option = select.options[index];
      const label = option ? optionText(option) : "";
      if (value.textContent !== label) value.textContent = label;
      items.forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
      if (trigger.disabled !== select.disabled) trigger.disabled = select.disabled;
      if (select.disabled && isOpen) close();
    }

    function setActive(index, scroll = false) {
      if (activeIndex === index && items[index]?.classList.contains("is-active")) return;
      items[activeIndex]?.classList.remove("is-active");
      activeIndex = index;
      const item = items[index];
      if (!item) { trigger.removeAttribute("aria-activedescendant"); return; }
      item.classList.add("is-active");
      trigger.setAttribute("aria-activedescendant", item.id);
      if (scroll && panel.scrollHeight > panel.clientHeight) {
        if (item.offsetTop < panel.scrollTop) panel.scrollTop = item.offsetTop - 6;
        else if (item.offsetTop + item.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = item.offsetTop + item.offsetHeight - panel.clientHeight + 6;
      }
    }

    const enabledIndexes = () => items.map((item, i) => (item.getAttribute("aria-disabled") === "true" ? -1 : i)).filter(i => i >= 0);
    function move(step) {
      const list = enabledIndexes();
      if (!list.length) return;
      const at = list.indexOf(activeIndex);
      const next = at < 0 ? (step > 0 ? list[0] : list.at(-1)) : list[Math.min(list.length - 1, Math.max(0, at + step))];
      setActive(next, true);
    }

    function position() {
      panel.style.maxHeight = "";
      panel.style.left = "";
      panel.dataset.placement = "bottom";
      const anchor = wrapper.getBoundingClientRect();
      const bounds = clipBounds(wrapper);
      const height = panel.offsetHeight;
      const below = bounds.bottom - anchor.bottom - GAP - EDGE;
      const above = anchor.top - bounds.top - GAP - EDGE;
      if (height > below) {
        if (height <= above || above > below) panel.dataset.placement = "top";
        const room = panel.dataset.placement === "top" ? above : below;
        if (height > room) panel.style.maxHeight = `${Math.max(MIN_HEIGHT, Math.floor(room))}px`;
      }
      // 水平：默认与按钮左缘对齐；超出右侧时贴按钮右缘；仍超出左侧时贴边界
      const width = panel.offsetWidth;
      let left = 0;
      if (anchor.left + width > bounds.right - EDGE) left = anchor.width - width;
      if (anchor.left + left < bounds.left + EDGE) left = bounds.left + EDGE - anchor.left;
      if (left !== 0) panel.style.left = `${Math.round(left)}px`;
      anchorTop = anchor.top;
      anchorWidth = window.innerWidth;
    }

    const isHidden = () => !trigger.isConnected || trigger.getClientRects().length === 0 || Boolean(trigger.closest('[hidden], [inert], [aria-hidden="true"]'));

    function onDocPointerDown(event) {
      if (!wrapper.contains(event.target)) close();
    }
    function onScroll(event) {
      if (panel.contains(event.target)) return;
      // 按钮所在的滚动层（页面、弹窗）滚动才关闭；无关区域（如 AI 回复区自动滚动）不影响
      if (Math.abs(wrapper.getBoundingClientRect().top - anchorTop) > 1) close();
    }
    function onResize() {
      // 宽度变化关闭；只有高度变化（手机键盘收起、地址栏伸缩）时重新定位，避免刚打开就被关掉
      if (window.innerWidth !== anchorWidth) close();
      else if (isOpen) position();
    }
    function onToggle(event) {
      if (event.target instanceof HTMLDetailsElement && event.target.open) close();
    }
    function onMutation() {
      if (!hiddenAtOpen && isHidden()) close();
    }
    const onHashChange = () => close();

    function listen(on) {
      const method = on ? "addEventListener" : "removeEventListener";
      doc[method]("pointerdown", onDocPointerDown, true);
      doc[method]("scroll", onScroll, true);
      doc[method]("toggle", onToggle, true);
      window[method]("resize", onResize);
      window[method]("hashchange", onHashChange);
      window.visualViewport?.[method]("resize", onResize);
      if (on) {
        observer = new MutationObserver(onMutation);
        observer.observe(doc.documentElement, { attributes: true, subtree: true, attributeFilter: ["class", "hidden", "inert", "aria-hidden"] });
      } else {
        observer?.disconnect();
        observer = null;
      }
    }

    function open() {
      if (isOpen || compat() || select.disabled) return;
      if (current && current !== api) current.close();
      // 同一时间只开一个：关掉 AI 问答“更多”菜单
      doc.querySelectorAll("details.ai-tutor-more[open]").forEach(details => { details.open = false; });
      build();
      isOpen = true;
      current = api;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      wrapper.classList.add("is-open");
      position();
      const selected = nativeIndex.get.call(select);
      setActive(items[selected] && items[selected].getAttribute("aria-disabled") !== "true" ? selected : (enabledIndexes()[0] ?? -1), true);
      if (doc.activeElement !== trigger) trigger.focus({ preventScroll: true });
      hiddenAtOpen = isHidden();
      listen(true);
    }

    function close({ focus = false } = {}) {
      if (!isOpen) return;
      isOpen = false;
      if (current === api) current = null;
      listen(false);
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      wrapper.classList.remove("is-open");
      items[activeIndex]?.classList.remove("is-active");
      activeIndex = -1;
      if (focus) trigger.focus({ preventScroll: true });
    }

    function choose(index) {
      const option = select.options[index];
      if (!option || option.disabled) return;
      const changed = nativeIndex.get.call(select) !== index;
      close({ focus: true });
      if (!changed) return;
      select.selectedIndex = index;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    trigger.addEventListener("click", event => {
      event.preventDefault();
      if (compat()) return;
      if (isOpen) close({ focus: true });
      else open();
    });
    trigger.addEventListener("keydown", event => {
      if (compat() || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const { key } = event;
      if (!isOpen) {
        if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          open();
        }
        return;
      }
      let handled = true;
      if (key === "ArrowDown") move(1);
      else if (key === "ArrowUp") move(-1);
      else if (key === "Home") setActive(enabledIndexes()[0] ?? -1, true);
      else if (key === "End") setActive(enabledIndexes().at(-1) ?? -1, true);
      else if (key === "Enter" || key === " ") choose(activeIndex);
      else if (key === "Escape") close({ focus: true }); // 只关面板：阻止冒泡，不连带关闭个人密钥弹窗或 AI 问答
      else if (key === "Tab") { close(); handled = false; } // 正常移动焦点
      else handled = false;
      if (handled) { event.preventDefault(); event.stopPropagation(); }
    });
    // 空格在 keyup 时才激活按钮：已在 keydown 处理，这里阻止二次点击
    trigger.addEventListener("keyup", event => { if (event.key === " ") event.preventDefault(); });
    trigger.addEventListener("blur", () => { if (isOpen) close(); });

    // 面板：按下不夺走按钮焦点；不冒泡到 AI 小窗头部（否则会被当成拖动并捕获指针）；点击不触发外层 label 的转发
    panel.addEventListener("pointerdown", event => { event.preventDefault(); event.stopPropagation(); });
    panel.addEventListener("pointermove", event => {
      const item = event.target.closest?.(".menu-select-option");
      if (item && item.getAttribute("aria-disabled") !== "true") setActive(Number(item.dataset.index));
    });
    panel.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const item = event.target.closest?.(".menu-select-option");
      if (item) choose(Number(item.dataset.index));
    });

    // 原生 select → 按钮：程序赋值不触发事件，包装实例上的 value / selectedIndex setter（做法同 mobile-shell.js 题目输入框）
    for (const [prop, descriptor] of [["value", nativeValue], ["selectedIndex", nativeIndex]]) {
      if (!descriptor?.get || !descriptor?.set || Object.getOwnPropertyDescriptor(select, prop)) continue;
      Object.defineProperty(select, prop, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() { return descriptor.get.call(this); },
        set(next) { descriptor.set.call(this, next); sync(); }
      });
    }
    select.addEventListener("input", sync);
    select.addEventListener("change", sync);
    // 点原 <label for> 或脚本聚焦原生 select 时，把焦点交给触发按钮
    select.addEventListener("focus", () => { if (!compat()) trigger.focus({ preventScroll: true }); });
    new MutationObserver(build).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["label", "disabled"] });

    function applyMode() {
      const enhanced = !compat();
      if (enhanced) {
        select.classList.add("menu-select-native");
        select.setAttribute("tabindex", "-1");
        select.setAttribute("aria-hidden", "true");
      } else {
        close();
        select.classList.remove("menu-select-native");
        if (originalTabindex === null) select.removeAttribute("tabindex"); else select.setAttribute("tabindex", originalTabindex);
        if (originalHidden === null) select.removeAttribute("aria-hidden"); else select.setAttribute("aria-hidden", originalHidden);
      }
    }

    const api = { select, trigger, panel, open, close, sync, applyMode, get isOpen() { return isOpen; } };
    build();
    applyMode();
    instances.push(api);
    return api;
  }

  doc.querySelectorAll("select[data-menu-select]").forEach(enhance);

  // 鸿蒙兼容模式可能在本脚本之后才加上：只在模式真正切换时处理
  let compatState = compat();
  new MutationObserver(() => {
    if (compat() === compatState) return;
    compatState = compat();
    instances.forEach(instance => instance.applyMode());
  }).observe(body, { attributes: true, attributeFilter: ["class"] });

  window.MasterLabMenuSelect = {
    enhance,
    close: () => current?.close(),
    get open() { return current; }
  };
})();
