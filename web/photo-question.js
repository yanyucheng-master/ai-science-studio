/*
 * 拍照 / 上传照片识题。
 * - 手机（粗指针设备）：直接唤起系统相机；电脑：打开页面内取景框（getUserMedia，需要 HTTPS 或 localhost）。
 * - “上传照片”只接受 JPG / PNG / WebP，先用文件头校验真实格式，再压缩成 JPEG。
 * - 照片发往网关 /api/v1/question/recognize，识别出的文字只填入题目输入框，由学生核对后再点“生成实验”。
 */
(() => {
  "use strict";

  const RECOGNIZE_PATH = "/api/v1/question/recognize";
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_SIDE = 1920;
  const TARGET_BYTES = 1500000;
  const REQUEST_TIMEOUT_MS = 120000;
  const COLD_START_NOTICE_MS = 10000;
  const UNCLEAR_MARK = "[?]";
  const SUCCESS_NOTE_MS = 14000;
  const ERROR_NOTE_MS = 12000;

  const MESSAGES = {
    UNREACHABLE: "暂时连不上识别服务（可能正在唤醒，或当前网络无法访问），请稍后重试。",
    TIMEOUT: "识别用时过长，请稍后重试，或换一张更清晰的照片。",
    NOT_AVAILABLE: "当前 AI 服务还没有开通照片识别，请直接输入题目。",
    NOT_CONFIGURED: "照片识别服务暂未配置，请直接输入题目。",
    TOO_LARGE: "照片太大，请换一张或降低画质后重试。",
    INVALID_IMAGE: "这张图片无法识别，请换一张 JPG、PNG 或 WebP 照片。",
    RATE_LIMITED: "识别太频繁了，请稍等一会儿再试。",
    BUSY: "识别服务正忙，请稍后重试。",
    UNAVAILABLE: "识别服务暂时不可用，请稍后重试。",
    INVALID_RESPONSE: "识别结果格式异常，请重试。",
    NO_QUESTION: "没有在照片里找到题目，请让题目占满画面、光线充足后重拍。"
  };

  const $ = selector => document.querySelector(selector);
  const els = {
    input: $("#questionInput"),
    cameraButton: $("#photoCameraButton"),
    fileButton: $("#photoFileButton"),
    fileInput: $("#photoFileInput"),
    cameraInput: $("#photoCameraInput"),
    status: $("#photoStatus"),
    dialog: $("#photoCamera"),
    video: $("#photoCameraVideo"),
    review: $("#photoCameraReview"),
    cancel: $("#photoCameraCancel"),
    flip: $("#photoCameraFlip"),
    shutter: $("#photoCameraShutter"),
    retake: $("#photoCameraRetake"),
    use: $("#photoCameraUse")
  };
  if (!els.input || !els.cameraButton || !els.fileButton || !els.fileInput) return;

  const state = {
    busy: false,
    controller: null,
    statusTimer: 0,
    camera: { stream: null, facing: "environment", blob: null, reviewUrl: "", restoreFocus: null }
  };

  class PhotoError extends Error {
    constructor(code, message) {
      super(message || MESSAGES[code] || code);
      this.code = code;
    }
  }

  const prefersSystemCamera = () => Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  const canUseLiveCamera = () => Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);

  /* ---------- 状态行 ---------- */

  function showStatus(text, tone, options = {}) {
    if (!els.status) return;
    window.clearTimeout(state.statusTimer);
    els.status.textContent = "";
    els.status.dataset.tone = tone;
    if (tone === "busy") {
      els.status.appendChild(document.createElement("i"));
    }
    const label = document.createElement("span");
    label.textContent = text;
    els.status.appendChild(label);
    if (options.cancel) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "取消";
      cancel.addEventListener("click", () => state.controller && state.controller.abort("user"));
      els.status.appendChild(cancel);
    }
    els.status.hidden = false;
    if (options.hideAfter) state.statusTimer = window.setTimeout(hideStatus, options.hideAfter);
  }

  function hideStatus() {
    if (!els.status) return;
    window.clearTimeout(state.statusTimer);
    els.status.hidden = true;
    els.status.textContent = "";
    delete els.status.dataset.tone;
  }

  function setBusy(busy) {
    state.busy = busy;
    els.cameraButton.disabled = busy;
    els.fileButton.disabled = busy;
    els.input.readOnly = busy;
    if (busy) els.input.setAttribute("aria-busy", "true");
    else els.input.removeAttribute("aria-busy");
  }

  function fail(error) {
    const code = error && error.code;
    if (code === "ABORTED") {
      showStatus("已取消识别。", "warn", { hideAfter: 4000 });
      return;
    }
    const message = error instanceof PhotoError ? error.message : MESSAGES.UNAVAILABLE;
    showStatus(message, "error", { hideAfter: ERROR_NOTE_MS });
  }

  /* ---------- 图片校验与压缩 ---------- */

  function ascii(bytes, from, to) {
    let out = "";
    for (let i = from; i < to && i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
    return out;
  }

  function sniffImageType(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
    if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
    if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && /^(hei|hev|mif1|msf1)/.test(ascii(bytes, 8, 12))) return "image/heic";
    return "";
  }

  async function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return { source: await createImageBitmap(file), width: 0, height: 0, release() {} };
      } catch {
        /* 退回 <img> 解码 */
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, release() { URL.revokeObjectURL(url); } };
    } catch {
      URL.revokeObjectURL(url);
      throw new PhotoError("INVALID_IMAGE", "无法读取这张图片，请换一张 JPG、PNG 或 WebP 照片。");
    }
  }

  function toBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  async function encodeJpeg(source, width, height) {
    let scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    let last = null;
    for (let round = 0; round < 4; round += 1) {
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, w, h);
      context.drawImage(source, 0, 0, w, h);
      for (const quality of [0.86, 0.74, 0.62]) {
        const blob = await toBlob(canvas, "image/jpeg", quality);
        if (!blob) throw new PhotoError("INVALID_IMAGE", "无法处理这张图片，请换一张试试。");
        last = blob;
        if (blob.size <= TARGET_BYTES) return blob;
      }
      scale *= 0.8;
    }
    return last;
  }

  async function blobFromFile(file) {
    if (file.size === 0) throw new PhotoError("INVALID_IMAGE", "这个文件是空的，请重新选择照片。");
    if (file.size > MAX_FILE_BYTES) throw new PhotoError("TOO_LARGE", "照片超过 20MB，请换一张或降低画质后重试。");
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const type = sniffImageType(head);
    if (type === "image/heic") {
      throw new PhotoError("INVALID_IMAGE", "暂不支持 HEIC 格式，请直接拍照，或在相册中导出为 JPG 后再上传。");
    }
    if (!type) throw new PhotoError("INVALID_IMAGE", "仅支持 JPG、PNG、WebP 格式的照片。");
    const decoded = await decodeImage(file);
    try {
      const width = decoded.width || decoded.source.width;
      const height = decoded.height || decoded.source.height;
      if (!width || !height) throw new PhotoError("INVALID_IMAGE", "无法读取这张图片，请换一张试试。");
      return await encodeJpeg(decoded.source, width, height);
    } finally {
      if (typeof decoded.source.close === "function") decoded.source.close();
      decoded.release();
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new PhotoError("INVALID_IMAGE", "无法读取这张图片，请换一张试试。"));
      reader.readAsDataURL(blob);
    });
  }

  /* ---------- 识别请求 ---------- */

  function gatewayBase() {
    const tutor = window.MasterLabAITutor;
    const base = (tutor && tutor.sceneServiceConfig && tutor.sceneServiceConfig.gatewayBase) || window.MASTER_LAB_API_URL || "";
    return String(base).replace(/\/$/, "");
  }

  function errorCodeFromResponse(status, payload) {
    const name = payload && typeof payload.error === "string" ? payload.error : "";
    if (status === 404 || name === "NOT_FOUND") return "NOT_AVAILABLE";
    if (status === 413 || name === "BODY_TOO_LARGE" || name === "IMAGE_TOO_LARGE") return "TOO_LARGE";
    if (name === "INVALID_IMAGE") return "INVALID_IMAGE";
    if (name === "INVALID_AI_RESPONSE") return "INVALID_RESPONSE";
    if (name === "AI_BUSY") return "BUSY";
    if (status === 429 || name === "RATE_LIMITED" || name === "AI_RATE_LIMITED") return "RATE_LIMITED";
    if (name === "AI_NOT_CONFIGURED") return "NOT_CONFIGURED";
    if (status === 504 || name === "AI_TIMEOUT") return "TIMEOUT";
    return "UNAVAILABLE";
  }

  async function requestRecognition(blob) {
    const image = await blobToDataUrl(blob);
    const controller = new AbortController();
    state.controller = controller;
    const timeoutId = window.setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);
    const noticeId = window.setTimeout(() => {
      showStatus("AI 服务可能正在唤醒，约需 30–60 秒，请稍候…", "busy", { cancel: true });
    }, COLD_START_NOTICE_MS);
    try {
      let response;
      try {
        response = await fetch(`${gatewayBase()}${RECOGNIZE_PATH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
          signal: controller.signal
        });
      } catch {
        if (controller.signal.aborted) {
          throw new PhotoError(controller.signal.reason === "timeout" ? "TIMEOUT" : "ABORTED");
        }
        throw new PhotoError("UNREACHABLE");
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) throw new PhotoError(errorCodeFromResponse(response.status, payload));
      const text = payload && typeof payload.text === "string" ? payload.text.replace(/\r\n?/g, "\n").trim() : "";
      if (!payload || typeof payload !== "object" || typeof payload.isQuestion !== "boolean" || typeof payload.text !== "string") throw new PhotoError("INVALID_RESPONSE");
      if (payload.isQuestion === false || !text) throw new PhotoError("NO_QUESTION");
      return { text, unclear: payload.unclear === true || text.includes(UNCLEAR_MARK), multiple: payload.multiple === true, truncated: payload.truncated === true };
    } finally {
      window.clearTimeout(timeoutId);
      window.clearTimeout(noticeId);
      if (state.controller === controller) state.controller = null;
    }
  }

  function fillQuestion(text) {
    const input = els.input;
    input.readOnly = false;
    let inserted = false;
    if (!prefersSystemCamera()) {
      try {
        input.focus({ preventScroll: true });
        input.select();
        inserted = document.execCommand("insertText", false, text) && input.value === text;
      } catch {
        inserted = false;
      }
    }
    if (!inserted) {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const mark = input.value.indexOf(UNCLEAR_MARK);
    if (mark >= 0 && !prefersSystemCamera()) {
      try { input.setSelectionRange(mark, mark + UNCLEAR_MARK.length); } catch { /* 忽略 */ }
    }
    if (typeof input.scrollIntoView === "function") input.scrollIntoView({ block: "nearest" });
  }

  async function processBlob(getBlob) {
    if (state.busy) return;
    setBusy(true);
    showStatus("正在处理照片…", "busy");
    try {
      const blob = await getBlob();
      showStatus("正在识别照片中的题目…", "busy", { cancel: true });
      const result = await requestRecognition(blob);
      setBusy(false);
      fillQuestion(result.text);
      if (result.truncated) {
        showStatus("题目过长，只填入了前 1500 字。请补全或改拍单道题，再点“生成实验”。", "warn", { hideAfter: SUCCESS_NOTE_MS });
      } else if (result.unclear) {
        showStatus("有看不清的地方，已用 [?] 标出。请补全后再点“生成实验”。", "warn", { hideAfter: SUCCESS_NOTE_MS });
      } else if (result.multiple) {
        showStatus("照片里有多道题，只识别了最完整的一道。请核对后再点“生成实验”。", "warn", { hideAfter: SUCCESS_NOTE_MS });
      } else {
        showStatus("已识别，请核对题目后再点“生成实验”。", "ok", { hideAfter: SUCCESS_NOTE_MS });
      }
    } catch (error) {
      setBusy(false);
      fail(error);
    } finally {
      if (state.busy) setBusy(false);
    }
  }

  /* ---------- 上传照片 ---------- */

  els.fileButton.addEventListener("click", () => {
    if (!state.busy) els.fileInput.click();
  });

  function bindFileInput(input) {
    if (!input) return;
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.value = "";
      if (file) processBlob(() => blobFromFile(file));
    });
  }
  bindFileInput(els.fileInput);
  bindFileInput(els.cameraInput);

  /* ---------- 拍照 ---------- */

  els.cameraButton.addEventListener("click", () => {
    if (state.busy) return;
    if (prefersSystemCamera() && els.cameraInput) {
      els.cameraInput.click();
      return;
    }
    if (!canUseLiveCamera() || !els.dialog) {
      showStatus("当前页面无法打开摄像头（需要 HTTPS 页面），请改用“上传照片”。", "error", { hideAfter: ERROR_NOTE_MS });
      return;
    }
    openCamera();
  });

  function stopStream() {
    const stream = state.camera.stream;
    state.camera.stream = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (els.video) els.video.srcObject = null;
  }

  function clearReview() {
    if (state.camera.reviewUrl) URL.revokeObjectURL(state.camera.reviewUrl);
    state.camera.reviewUrl = "";
    state.camera.blob = null;
    if (els.review) els.review.removeAttribute("src");
  }

  function setCameraMode(mode) {
    els.dialog.dataset.mode = mode;
    const live = mode === "live";
    els.video.hidden = !live;
    els.review.hidden = live;
    els.cancel.hidden = !live;
    els.shutter.hidden = !live;
    els.retake.hidden = live;
    els.use.hidden = live;
    if (!live) els.flip.hidden = true;
  }

  async function startStream() {
    stopStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: state.camera.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    if (els.dialog.hidden || els.dialog.dataset.mode !== "live") {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    state.camera.stream = stream;
    els.video.srcObject = stream;
    try { await els.video.play(); } catch { /* 自动播放被拦截时用户点击拍照仍可用 */ }
    els.shutter.disabled = false;
    els.shutter.focus();
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      els.flip.hidden = devices.filter(device => device.kind === "videoinput").length < 2;
    } catch {
      els.flip.hidden = true;
    }
  }

  function cameraErrorMessage(error) {
    const name = error && error.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "摄像头权限被拒绝。请在浏览器地址栏允许使用摄像头，或改用“上传照片”。";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "没有检测到可用的摄像头，请改用“上传照片”。";
    }
    if (name === "NotReadableError" || name === "AbortError") {
      return "摄像头正被其他程序占用，请关闭后重试，或改用“上传照片”。";
    }
    return "无法打开摄像头，请改用“上传照片”。";
  }

  function openCamera() {
    state.camera.restoreFocus = document.activeElement;
    clearReview();
    els.dialog.hidden = false;
    document.body.classList.add("photo-camera-open");
    setCameraMode("live");
    els.shutter.disabled = true;
    startStream().catch(error => {
      closeCamera(false);
      showStatus(cameraErrorMessage(error), "error", { hideAfter: ERROR_NOTE_MS });
    });
  }

  function closeCamera(restoreFocus = true) {
    stopStream();
    clearReview();
    els.dialog.hidden = true;
    document.body.classList.remove("photo-camera-open");
    const target = state.camera.restoreFocus;
    state.camera.restoreFocus = null;
    if (restoreFocus && target && target.isConnected && typeof target.focus === "function") target.focus({ preventScroll: true });
  }

  async function takePhoto() {
    const video = els.video;
    if (!state.camera.stream || !video.videoWidth) return;
    els.shutter.disabled = true;
    try {
      const blob = await encodeJpeg(video, video.videoWidth, video.videoHeight);
      clearReview();
      state.camera.blob = blob;
      state.camera.reviewUrl = URL.createObjectURL(blob);
      els.review.src = state.camera.reviewUrl;
      stopStream();
      setCameraMode("review");
      els.use.focus();
    } catch (error) {
      closeCamera();
      fail(error);
    } finally {
      els.shutter.disabled = false;
    }
  }

  if (els.dialog) {
    els.cancel.addEventListener("click", () => closeCamera());
    els.shutter.addEventListener("click", takePhoto);
    els.flip.addEventListener("click", () => {
      state.camera.facing = state.camera.facing === "environment" ? "user" : "environment";
      els.shutter.disabled = true;
      startStream().catch(error => {
        closeCamera(false);
        showStatus(cameraErrorMessage(error), "error", { hideAfter: ERROR_NOTE_MS });
      });
    });
    els.retake.addEventListener("click", () => {
      clearReview();
      setCameraMode("live");
      els.shutter.disabled = true;
      startStream().catch(error => {
        closeCamera(false);
        showStatus(cameraErrorMessage(error), "error", { hideAfter: ERROR_NOTE_MS });
      });
    });
    els.use.addEventListener("click", () => {
      const blob = state.camera.blob;
      state.camera.blob = null;
      closeCamera();
      if (blob) processBlob(async () => blob);
    });
    els.dialog.addEventListener("click", event => {
      if (event.target === els.dialog) closeCamera();
    });
    els.dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCamera();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(els.dialog.querySelectorAll("button")).filter(button => !button.hidden && !button.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    window.addEventListener("pagehide", () => closeCamera(false));
  }

  /* 学生开始修改题目后，识别提示就不再需要了 */
  els.input.addEventListener("input", event => {
    if (event.isTrusted && els.status && !els.status.hidden && els.status.dataset.tone !== "busy") hideStatus();
  });
})();
