(() => {
  "use strict";

  const button = document.querySelector("#announcementsButton");
  const dialog = document.querySelector("#announcementsDialog");
  if (!button || !dialog) return;

  const dot = document.querySelector("#announcementsDot");
  const list = document.querySelector("#announcementsList");
  const count = document.querySelector("#announcementsCount");
  const status = document.querySelector("#announcementsStatus");
  const empty = document.querySelector("#announcementsEmpty");
  const refreshButton = document.querySelector("#announcementsRefresh");
  const readAllButton = document.querySelector("#announcementsReadAll");
  const storageNote = document.querySelector("#announcementsStorageNote");
  const storageKey = "masterLab.announcementReads.v1";
  let announcements = [];
  let loaded = false;
  let loading = false;
  let loadError = false;
  let pending = null;

  function parseReads(raw) {
    try {
      const value = JSON.parse(raw || "[]");
      return new Set(Array.isArray(value) ? value.filter(item => typeof item === "string").slice(-500) : []);
    } catch {
      return new Set();
    }
  }

  let readKeys;
  try {
    readKeys = parseReads(window.localStorage.getItem(storageKey));
  } catch {
    readKeys = new Set();
    storageNote.hidden = false;
  }

  const keyFor = item => `${item.id}@${item.revision}`;
  const textNode = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };

  function syncState() {
    const unread = announcements.filter(item => !readKeys.has(keyFor(item))).length;
    dot.hidden = unread === 0;
    button.setAttribute("aria-label", unread ? `更新公告，有 ${unread} 条未读` : "查看更新公告");
    button.title = unread ? `更新公告 · ${unread} 条未读` : "更新公告";
    count.textContent = loaded ? `${announcements.length} 条公告 · ${unread ? `${unread} 条未读` : "全部已读"}`
      : loadError && !loading ? "公告暂不可用" : "正在检查公告";
    readAllButton.disabled = unread === 0;
    refreshButton.disabled = loading;
    refreshButton.textContent = loading ? "刷新中…" : "刷新";
    status.hidden = !loading && !loadError;
    status.textContent = loading ? "正在检查最新公告…" : loaded
      ? "暂时无法检查新公告，以下为上次加载的内容。请稍后刷新重试。"
      : "公告加载失败，请点击刷新重试。";
    empty.hidden = !loaded || announcements.length > 0 || loading || loadError;
    list.querySelectorAll(".announcement-item").forEach(item => {
      item.querySelector(".announcement-unread").hidden = readKeys.has(item.dataset.announcementKey);
    });
  }

  function saveReads() {
    try {
      const saved = parseReads(window.localStorage.getItem(storageKey));
      readKeys.forEach(key => saved.add(key));
      readKeys = saved;
      window.localStorage.setItem(storageKey, JSON.stringify([...readKeys].slice(-500)));
      storageNote.hidden = true;
    } catch {
      storageNote.hidden = false;
    }
    syncState();
  }

  function renderList() {
    const openKeys = new Set([...list.querySelectorAll("details[open]")].map(item => item.dataset.announcementKey));
    const focusedKey = document.activeElement?.closest(".announcement-item")?.dataset.announcementKey;
    const fragment = document.createDocumentFragment();
    announcements.forEach((item, index) => {
      const key = keyFor(item);
      const card = document.createElement("details");
      card.className = "announcement-item";
      card.dataset.announcementKey = key;
      card.open = openKeys.has(key);
      const summary = document.createElement("summary");
      const meta = textNode("div", "announcement-meta", "");
      const date = textNode("time", "", item.date.replaceAll("-", "."));
      date.dateTime = item.date;
      meta.append(date);
      if (index === 0) meta.append(textNode("span", "announcement-latest", "最新"));
      const unread = textNode("span", "announcement-unread", "未读");
      unread.hidden = readKeys.has(key);
      meta.append(unread);
      summary.append(meta, textNode("h3", "", item.title), textNode("p", "", item.summary));
      const details = document.createElement("ul");
      item.details.forEach(line => details.append(textNode("li", "", line)));
      card.append(summary, details);
      card.addEventListener("toggle", () => {
        if (card.open && !readKeys.has(key)) {
          readKeys.add(key);
          saveReads();
        }
      });
      fragment.append(card);
    });
    list.replaceChildren(fragment);
    if (focusedKey) {
      [...list.children].find(item => item.dataset.announcementKey === focusedKey)?.querySelector("summary").focus();
    }
  }

  function validateFeed(feed) {
    const boundedText = (text, limit) => typeof text === "string" && text.trim().length > 0 && text.length <= limit;
    if (feed?.version !== 1 || !Array.isArray(feed.announcements) || feed.announcements.length > 100) throw new Error("Invalid announcement feed");
    const ids = new Set();
    for (const item of feed.announcements) {
      if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)
        || !Number.isSafeInteger(item.revision) || item.revision < 1
        || typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
        || !Number.isFinite(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0, 10) !== item.date
        || !boundedText(item.title, 100) || !boundedText(item.summary, 300)
        || !Array.isArray(item.details) || item.details.length < 1 || item.details.length > 8
        || !item.details.every(line => boundedText(line, 1000))) throw new Error("Invalid announcement entry");
      ids.add(item.id);
    }
    return [...feed.announcements].sort((a, b) => b.date.localeCompare(a.date));
  }

  function refresh() {
    if (pending) return pending;
    loading = true;
    syncState();
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(new URL("announcements.json", document.baseURI), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Announcement request failed");
        const next = validateFeed(await response.json());
        if (JSON.stringify(next) !== JSON.stringify(announcements)) {
          announcements = next;
          renderList();
        }
        loaded = true;
        loadError = false;
      } catch {
        loadError = true;
      } finally {
        clearTimeout(timeout);
        loading = false;
        pending = null;
        syncState();
      }
    })();
    return pending;
  }

  button.addEventListener("click", () => {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("announcements-open");
    button.setAttribute("aria-expanded", "true");
    refresh();
  });
  document.querySelector("#announcementsClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    document.body.classList.remove("announcements-open");
    button.setAttribute("aria-expanded", "false");
    button.focus({ preventScroll: true });
  });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...dialog.querySelectorAll("button:not(:disabled), summary")];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  refreshButton.addEventListener("click", refresh);
  readAllButton.addEventListener("click", () => {
    announcements.forEach(item => readKeys.add(keyFor(item)));
    saveReads();
  });
  window.addEventListener("storage", event => {
    if (event.key !== storageKey && event.key !== null) return;
    try { readKeys = parseReads(event.newValue); } catch { readKeys = new Set(); }
    syncState();
  });
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60 * 1000);
  refresh();
})();
