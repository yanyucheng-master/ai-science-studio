// 轨道烧瓶品牌动效：开屏、AI 思考图标、生成加载、完成反馈、断网状态。
// 几何取自 assets/brand/orbit-flask-2026-10-04；样式在 styles.css 末尾的“轨道烧瓶动效”区块。
// 本文件在 <body> 最前面同步加载，开屏不必等页面其余脚本。
(() => {
  "use strict";

  const G = {
    flask: "M524 470V300C524 285 515 278 500 276C485 274 478 263 478 253C478 243 487 235 500 235H752C765 235 774 243 774 253C774 263 767 274 752 276C737 278 728 285 728 300V470C728 490 734 505 740 515L946 870C964 902 970 945 962 975C952 1005 922 1023 872 1023H380C330 1023 300 1005 290 975C282 945 288 902 306 870L512 515C518 505 524 490 524 470Z",
    halfR: "M626 235H752C765 235 774 243 774 253C774 263 767 274 752 276C737 278 728 285 728 300V470C728 490 734 505 740 515L946 870C964 902 970 945 962 975C952 1005 922 1023 872 1023H626",
    halfL: "M626 235H500C487 235 478 243 478 253C478 263 485 274 500 276C515 278 524 285 524 300V470C524 490 518 505 512 515L306 870C288 902 282 945 290 975C300 1005 330 1023 380 1023H626",
    ringFull: "M1092.39 450.23A475.452 135.078 -13.2 1 1 166.61 667.37A475.452 135.078 -13.2 1 1 1092.39 450.23ZM1046.88 456.98A428.922 99.828 -13.32 1 1 212.12 654.62A428.922 99.828 -13.32 1 1 1046.88 456.98Z",
    ringSmall: "M1099.2 448.6A482.5 142.1 -13.2 1 1 159.8 669A482.5 142.1 -13.2 1 1 1099.2 448.6ZM1040.1 458.6A421.9 92.8 -13.32 1 1 218.9 653A421.9 92.8 -13.32 1 1 1040.1 458.6Z",
    orbit: "M1069.6 453.6A452.2 117.5 -13.26 1 1 189.4 661A452.2 117.5 -13.26 1 1 1069.6 453.6Z",
    back: "M-733.5 878.5L1992.5 239.1L1672.8 -1123.9L-1053.2 -484.5Z",
    front: "M-733.5 878.5L1992.5 239.1L2312.2 1602.1L-413.8 2241.5Z",
    liquid: "M153.7 1238L385.8 838L416.6 785C424.1 772 440 755 470 754C520 750 570 742 620 731C670 720 718 706 765 705C782 705 798.9 722 806.4 735L854.6 818L1098.3 1238Z"
  };
  // full = logo.svg（64px 以上）；small = 页首内联加粗版（24–48px）
  const WT = {
    full: { ring: G.ringFull, outline: 46, gap: 106, halo: 78, knock: 20 },
    small: { ring: G.ringSmall, outline: 62, gap: 126, halo: 98, knock: 24 }
  };
  const VB = "137.1 136.6 984.7 984.7";
  // 环中线参数角 0–360° 对应的弧长位置（pathLength = 100），用于让光点“正面快、两端慢”
  const PHI = [0.0,0.1054,0.2112,0.3178,0.4258,0.5355,0.6473,0.7615,0.8785,0.9987,1.1222,1.2493,1.3804,1.5155,1.6549,1.7987,1.9471,2.1002,2.2581,2.4208,2.5886,2.7614,2.9393,3.1223,3.3106,3.504,3.7026,3.9065,4.1156,4.3299,4.5495,4.7742,5.0042,5.2393,5.4796,5.7249,5.9753,6.2308,6.4912,6.7565,7.0267,7.3018,7.5816,7.8661,8.1553,8.4491,8.7473,9.05,9.3571,9.6685,9.9841,10.3038,10.6276,10.9554,11.2871,11.6225,11.9617,12.3046,12.6509,13.0008,13.3539,13.7104,14.07,14.4326,14.7983,15.1668,15.538,15.912,16.2885,16.6674,17.0487,17.4323,17.818,18.2057,18.5953,18.9868,19.3799,19.7747,20.1709,20.5685,20.9673,21.3673,21.7684,22.1703,22.5731,22.9765,23.3805,23.785,24.1898,24.5948,25.0,25.4052,25.8102,26.215,26.6195,27.0235,27.4269,27.8297,28.2316,28.6327,29.0327,29.4315,29.8291,30.2253,30.6201,31.0132,31.4047,31.7943,32.182,32.5677,32.9513,33.3326,33.7115,34.088,34.462,34.8332,35.2017,35.5674,35.93,36.2896,36.6461,36.9992,37.3491,37.6954,38.0383,38.3775,38.7129,39.0446,39.3724,39.6962,40.0159,40.3315,40.6429,40.95,41.2527,41.5509,41.8447,42.1339,42.4184,42.6982,42.9733,43.2435,43.5088,43.7692,44.0247,44.2751,44.5204,44.7607,44.9958,45.2258,45.4505,45.6701,45.8844,46.0935,46.2974,46.496,46.6894,46.8777,47.0607,47.2386,47.4114,47.5792,47.7419,47.8998,48.0529,48.2013,48.3451,48.4845,48.6196,48.7507,48.8778,49.0013,49.1215,49.2385,49.3527,49.4645,49.5742,49.6822,49.7888,49.8946,50.0,50.1054,50.2112,50.3178,50.4258,50.5355,50.6473,50.7615,50.8785,50.9987,51.1222,51.2493,51.3804,51.5155,51.6549,51.7987,51.9471,52.1002,52.2581,52.4208,52.5886,52.7614,52.9393,53.1223,53.3106,53.504,53.7026,53.9065,54.1156,54.3299,54.5495,54.7742,55.0042,55.2393,55.4796,55.7249,55.9753,56.2308,56.4912,56.7565,57.0267,57.3018,57.5816,57.8661,58.1553,58.4491,58.7473,59.05,59.3571,59.6685,59.9841,60.3038,60.6276,60.9554,61.2871,61.6225,61.9617,62.3046,62.6509,63.0008,63.3539,63.7104,64.07,64.4326,64.7983,65.1668,65.538,65.912,66.2885,66.6674,67.0487,67.4323,67.818,68.2057,68.5953,68.9868,69.3799,69.7747,70.1709,70.5685,70.9673,71.3673,71.7684,72.1703,72.5731,72.9765,73.3805,73.785,74.1898,74.5948,75.0,75.4052,75.8102,76.215,76.6195,77.0235,77.4269,77.8297,78.2316,78.6327,79.0327,79.4315,79.8291,80.2253,80.6201,81.0132,81.4047,81.7943,82.182,82.5677,82.9513,83.3326,83.7115,84.088,84.462,84.8332,85.2017,85.5674,85.93,86.2896,86.6461,86.9992,87.3491,87.6954,88.0383,88.3775,88.7129,89.0446,89.3724,89.6962,90.0159,90.3315,90.6429,90.95,91.2527,91.5509,91.8447,92.1339,92.4184,92.6982,92.9733,93.2435,93.5088,93.7692,94.0247,94.2751,94.5204,94.7607,94.9958,95.2258,95.4505,95.6701,95.8844,96.0935,96.2974,96.496,96.6894,96.8777,97.0607,97.2386,97.4114,97.5792,97.7419,97.8998,98.0529,98.2013,98.3451,98.4845,98.6196,98.7507,98.8778,99.0013,99.1215,99.2385,99.3527,99.4645,99.5742,99.6822,99.7888,99.8946,100.0];
  const WAVE_F = "M250 0.0 L260 4.0 L270 7.7 L280 11.0 L290 13.5 L300 15.2 L310 16.0 L320 15.7 L330 14.5 L340 12.3 L350 9.4 L360 5.9 L370 2.0 L380 -2.0 L390 -5.9 L400 -9.4 L410 -12.3 L420 -14.5 L430 -15.7 L440 -16.0 L450 -15.2 L460 -13.5 L470 -11.0 L480 -7.7 L490 -4.0 L500 -0.0 L510 4.0 L520 7.7 L530 11.0 L540 13.5 L550 15.2 L560 16.0 L570 15.7 L580 14.5 L590 12.3 L600 9.4 L610 5.9 L620 2.0 L630 -2.0 L640 -5.9 L650 -9.4 L660 -12.3 L670 -14.5 L680 -15.7 L690 -16.0 L700 -15.2 L710 -13.5 L720 -11.0 L730 -7.7 L740 -4.0 L750 -0.0 L760 4.0 L770 7.7 L780 11.0 L790 13.5 L800 15.2 L810 16.0 L820 15.7 L830 14.5 L840 12.3 L850 9.4 L860 5.9 L870 2.0 L880 -2.0 L890 -5.9 L900 -9.4 L910 -12.3 L920 -14.5 L930 -15.7 L940 -16.0 L950 -15.2 L960 -13.5 L970 -11.0 L980 -7.7 L990 -4.0 L1000 -0.0 L1010 4.0 L1020 7.7 L1030 11.0 L1040 13.5 L1050 15.2 L1060 16.0 L1070 15.7 L1080 14.5 L1090 12.3 L1100 9.4 L1110 5.9 L1120 2.0 L1130 -2.0 L1140 -5.9 L1150 -9.4 L1160 -12.3 L1170 -14.5 L1180 -15.7 L1190 -16.0 L1200 -15.2 L1210 -13.5 L1220 -11.0 L1230 -7.7 L1240 -4.0 L1250 -0.0 L1260 4.0 L1270 7.7 L1270 900 L250 900Z";
  const WAVE_B = "M250 11.4 L260 10.1 L270 8.2 L280 5.8 L290 3.0 L300 0.0 L310 -3.0 L320 -5.8 L330 -8.2 L340 -10.1 L350 -11.4 L360 -12.0 L370 -11.8 L380 -10.9 L390 -9.2 L400 -7.1 L410 -4.4 L420 -1.5 L430 1.5 L440 4.4 L450 7.1 L460 9.2 L470 10.9 L480 11.8 L490 12.0 L500 11.4 L510 10.1 L520 8.2 L530 5.8 L540 3.0 L550 0.0 L560 -3.0 L570 -5.8 L580 -8.2 L590 -10.1 L600 -11.4 L610 -12.0 L620 -11.8 L630 -10.9 L640 -9.2 L650 -7.1 L660 -4.4 L670 -1.5 L680 1.5 L690 4.4 L700 7.1 L710 9.2 L720 10.9 L730 11.8 L740 12.0 L750 11.4 L760 10.1 L770 8.2 L780 5.8 L790 3.0 L800 0.0 L810 -3.0 L820 -5.8 L830 -8.2 L840 -10.1 L850 -11.4 L860 -12.0 L870 -11.8 L880 -10.9 L890 -9.2 L900 -7.1 L910 -4.4 L920 -1.5 L930 1.5 L940 4.4 L950 7.1 L960 9.2 L970 10.9 L980 11.8 L990 12.0 L1000 11.4 L1010 10.1 L1020 8.2 L1030 5.8 L1040 3.0 L1050 0.0 L1060 -3.0 L1070 -5.8 L1080 -8.2 L1090 -10.1 L1100 -11.4 L1110 -12.0 L1120 -11.8 L1130 -10.9 L1140 -9.2 L1150 -7.1 L1160 -4.4 L1170 -1.5 L1180 1.5 L1190 4.4 L1200 7.1 L1210 9.2 L1220 10.9 L1230 11.8 L1240 12.0 L1250 11.4 L1260 10.1 L1270 8.2 L1270 900 L250 900Z";

  let uid = 0;
  function rig(o = {}) {
    const id = "mlfx" + (++uid);
    const w = WT[o.geo || "full"];
    const u = n => id + n;
    const M = 'maskUnits="userSpaceOnUse" x="-900" y="-900" width="3058" height="3058"';
    const R = '<rect x="-900" y="-900" width="3058" height="3058" fill="#fff"/>';
    const orb = c => `<use class="${c}" href="#${u("o")}"/>`;
    const comet = o.comet ? `<g class="fx-comet">${orb("t2")}${orb("t1")}${orb("h")}</g>` : "";
    const sheen = o.sheen ? `<g class="fx-sheen">${orb("s")}</g>` : "";
    const streak = o.burst ? `<g class="fx-streak">${orb("s")}</g>` : "";
    const ringLayer = () => {
      let inner = `<use class="fx-ring" href="#${u("r")}" fill-rule="evenodd"/>${comet}${sheen}${streak}`;
      if (o.brk) inner = `<g mask="url(#${u("brk")})">${inner}</g>`;
      if (o.reveal) inner = `<g clip-path="url(#${u("rv")})">${inner}</g>`;
      return `<g class="fx-ringset">${inner}</g>`;
    };
    const liquid = o.wave
      ? `<g class="fx-wave-lv"><g class="fx-surge"><g class="fx-wave-b"><path class="fx-liquid fx-liquid-back" d="${WAVE_B}"/></g><g class="fx-wave-f"><path class="fx-liquid" d="${WAVE_F}"/></g></g></g>`
      : `<g class="fx-liq-wrap"><g class="fx-liq-drop"><g class="fx-surge"><path class="fx-liquid" d="${G.liquid}"/></g></g></g>`;
    const liquidMasked = o.liquidReveal ? `<g mask="url(#${u("lq")})">${liquid}</g>` : liquid;
    const bubbles = o.wave
      ? '<circle class="fx-mb m1" cx="440" cy="990" r="17"/><circle class="fx-mb m2" cx="566" cy="1000" r="23"/><circle class="fx-mb m3" cx="702" cy="994" r="14"/><circle class="fx-mb m4" cx="828" cy="986" r="19"/>'
      : '<circle class="fx-bub fx-b1" cx="599" cy="902" r="48.7"/><circle class="fx-bub fx-b2" cx="745" cy="926" r="31.5"/>';
    const outline = o.split
      ? `<path class="fx-half" pathLength="1000" stroke-width="${w.outline}" d="${G.halfR}"/><path class="fx-half" pathLength="1000" stroke-width="${w.outline}" d="${G.halfL}"/>`
      : `<use class="fx-outline" href="#${u("f")}" stroke-width="${w.outline}"/>`;
    const glint = o.glint ? `<g mask="url(#${u("gm")})"><rect class="fx-glint" x="-90" y="60" width="120" height="1160" fill="url(#${u("gl")})" opacity="0"/></g>` : "";
    const dots = o.dots ? '<g class="fx-dots"><circle class="fx-dot d1" cx="626" cy="196" r="36" style="--dx:-34px"/><circle class="fx-dot d2" cx="626" cy="196" r="46" style="--dx:44px"/><circle class="fx-dot d3" cx="626" cy="196" r="30" style="--dx:8px"/></g>' : "";
    const B = [[-120, -250, 1.15, 0, 30, "l"], [95, -300, 1, .04, 24, "d"], [-30, -340, 1.25, .08, 34, "l"], [170, -200, .9, .02, 20, "l"], [-185, -165, .8, .1, 18, "d"], [36, -235, 1.05, .12, 26, "l"], [235, -310, .7, .06, 16, "l"]];
    const burst = o.burst ? `<g class="fx-burst">${B.map(([tx, ty, s, d, r, c]) => `<circle class="${c}" cx="626" cy="208" r="${r}" style="--tx:${tx}px;--ty:${ty}px;--s:${s};--d:${d}s"/>`).join("")}</g>` : "";
    const badge = o.badge ? '<g class="fx-badge"><circle cx="936" cy="948" r="112"/><path class="fx-check" pathLength="100" d="M884 950L922 988L992 914"/></g>' : "";
    const sparks = o.brk ? '<g><circle class="fx-joint" cx="974.5" cy="556.7" r="70"/><circle class="fx-spark" cx="974.5" cy="556.7" r="15" style="--tx:70px;--ty:-60px"/><circle class="fx-spark" cx="974.5" cy="556.7" r="11" style="--tx:58px;--ty:52px"/><circle class="fx-spark" cx="974.5" cy="556.7" r="9" style="--tx:-34px;--ty:-70px"/></g>' : "";
    return `<svg class="fx fx-g-${o.geo || "full"} ${o.cls || ""}" viewBox="${VB}" overflow="visible" aria-hidden="true" focusable="false"><defs>`
      + `<path id="${u("f")}" d="${G.flask}"/><path id="${u("r")}" d="${w.ring}"/><path id="${u("o")}" d="${G.orbit}" pathLength="100"/>`
      + `<clipPath id="${u("in")}"><use href="#${u("f")}"/></clipPath><clipPath id="${u("bk")}"><path d="${G.back}"/></clipPath><clipPath id="${u("ft")}"><path d="${G.front}"/></clipPath>`
      + `<mask id="${u("halo")}" ${M}>${R}<g class="fx-halo-shape"><use href="#${u("f")}" fill="#000" stroke="#000" stroke-width="${w.halo}" stroke-linejoin="round"/></g></mask>`
      + `<mask id="${u("gap")}" ${M}>${R}<use href="#${u("f")}" fill="none" stroke="#000" stroke-width="${w.gap}" stroke-linejoin="round"/></mask>`
      + `<mask id="${u("kn")}" ${M}>${R}<g class="fx-orbitT"><g clip-path="url(#${u("ft")})">${o.reveal ? `<g clip-path="url(#${u("rv")})">` : ""}<use href="#${u("r")}" fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="${w.knock}"/>${o.reveal ? "</g>" : ""}</g></g></mask>`
      + (o.reveal ? `<clipPath id="${u("rv")}"><path class="fx-rv" d="M0 0Z"/></clipPath>` : "")
      + (o.liquidReveal ? `<mask id="${u("lq")}" ${M}><path class="fx-lq" fill="#fff" d="M0 0Z"/></mask>` : "")
      + (o.brk ? `<mask id="${u("brk")}" ${M}>${R}<use class="fx-brk" href="#${u("o")}"/></mask>` : "")
      + (o.glint ? `<linearGradient id="${u("gl")}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${u("gm")}" ${M}><use href="#${u("f")}" fill="#fff" stroke="#fff" stroke-width="${w.outline}" stroke-linejoin="round"/></mask>` : "")
      + `</defs><g class="fx-root"><g class="fx-popwrap"><g class="fx-shake">`
      + (o.burst ? '<circle class="fx-ripple" cx="626" cy="640" r="420"/>' : "")
      + `<g mask="url(#${u("halo")})"><g class="fx-orbitT"><g clip-path="url(#${u("bk")})">${ringLayer()}</g></g></g>`
      + `<g mask="url(#${u("kn")})"><g class="fx-flask"><use class="fx-interior" href="#${u("f")}"/>`
      + `<g mask="url(#${u("gap")})"><g clip-path="url(#${u("in")})">${liquidMasked}</g></g>`
      + `<g clip-path="url(#${u("in")})"><g class="fx-bubbles">${bubbles}</g></g>${outline}${glint}</g></g>`
      + `<g class="fx-orbitT"><g clip-path="url(#${u("ft")})">${ringLayer()}</g></g>`
      + `${dots}${burst}${badge}${sparks}</g></g></g></svg>`;
  }

  /* ---------- 运行时工具 ---------- */
  const reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const reducedMotion = () => Boolean(reduceQuery && reduceQuery.matches);
  const isComet = a => String(a.animationName || "").startsWith("fxComet");
  const loopsOf = el => (el.getAnimations ? el.getAnimations({ subtree: true }) : [])
    .filter(a => a.effect && a.effect.getTiming().iterations === Infinity);
  // 平滑改变循环动画的速度（保留当前位置，不跳帧）
  function rampRate(el, to, ms = 420, filter = () => true) {
    if (!el) return;
    const list = loopsOf(el).filter(filter);
    const from = list.map(a => a.playbackRate);
    if (el._mlRamp) cancelAnimationFrame(el._mlRamp);
    if (reducedMotion() || !list.length) { list.forEach(a => { a.playbackRate = to; }); return; }
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - (1 - p) * (1 - p);
      list.forEach((a, i) => { a.playbackRate = from[i] + (to - from[i]) * e; });
      el._mlRamp = p < 1 ? requestAnimationFrame(step) : 0;
    };
    el._mlRamp = requestAnimationFrame(step);
  }
  function retrigger(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
  }
  function mount(root = document) {
    root.querySelectorAll("[data-brand-rig]").forEach(el => {
      if (el.firstElementChild) return;
      try { el.innerHTML = rig(JSON.parse(el.dataset.brandRig)); } catch { /* 图标缺失不影响页面 */ }
    });
  }
  function hoverBoost(host) {
    host.addEventListener("pointerenter", ev => { if (ev.pointerType !== "touch") rampRate(host.querySelector("svg"), 1.8, 300); });
    host.addEventListener("pointerleave", () => rampRate(host.querySelector("svg"), 1, 500));
  }

  /* ---------- 生成实验：液面 = 进度 ---------- */
  const loaderSvg = root => root && root.querySelector(".gen-core-flask svg");
  function setLevel(svg, p, instant) {
    if (instant) svg.classList.add("lv-instant");
    svg.style.setProperty("--lv", Math.max(0, Math.min(1, p)).toFixed(3));
    if (instant) { void svg.getBoundingClientRect(); svg.classList.remove("lv-instant"); }
  }
  function loaderReset(root) {
    const svg = loaderSvg(root); if (!svg) return;
    svg.classList.remove("is-done");
    setLevel(svg, 0, true);
    rampRate(svg, 1, 1, isComet);
  }
  function loaderStage(root, index, progress) {
    const svg = loaderSvg(root); if (!svg) return;
    setLevel(svg, (Number(progress) || 0) / 100);
    rampRate(svg, [1, 1.35, 1.8][Math.min(2, Math.max(0, index))], 300, isComet);
  }
  function loaderComplete(root) {
    const svg = loaderSvg(root); if (!svg) return;
    setLevel(svg, 1);
    retrigger(svg, "is-done");
    rampRate(svg, 1, 700, isComet);
  }

  /* ---------- 断网 ---------- */
  function offlineMark() {
    const mark = document.createElement("span");
    mark.className = "ai-offline-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = rig({ geo: "small", comet: true, brk: true, cls: "fx-think-a" });
    const svg = mark.firstElementChild;
    if (reducedMotion()) svg.classList.add("is-error");
    else requestAnimationFrame(() => requestAnimationFrame(() => breakLink(svg)));
    return mark;
  }
  function breakLink(svg) {
    if (!svg) return;
    svg.classList.remove("is-relink");
    svg.classList.add("is-error");
    rampRate(svg, 0, 520);
  }
  function relink(svg) {
    if (!svg || !svg.classList.contains("is-error")) return;
    svg.classList.remove("is-error");
    retrigger(svg, "is-relink");
    rampRate(svg, 1, 650);
    // 气泡里的小图标重连后停在静止的 logo 状态
    setTimeout(() => rampRate(svg, 0, 600), 1500);
  }

  /* ---------- 开屏 A「描线成型」 ---------- */
  const E = {
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    oc: t => 1 - Math.pow(1 - t, 3),
    ioc: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    ios: t => -(Math.cos(Math.PI * t) - 1) / 2,
    ob: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
  };
  const seg = (t, a, b) => E.clamp((t - a) / (b - a));
  const OC = { cx: 629.5, cy: 557.3, rx: 452.2, ry: 117.5, rot: -13.26 * Math.PI / 180 };
  const OU = [Math.cos(OC.rot), Math.sin(OC.rot)], OV = [-Math.sin(OC.rot), Math.cos(OC.rot)];
  function sAt(deg) {
    const lap = Math.floor(deg / 360), d = deg - lap * 360, i = Math.floor(d), f = d - i;
    return lap * 100 + PHI[i] + (PHI[Math.min(i + 1, 360)] - PHI[i]) * f;
  }
  function alphaAt(deg) {
    const lap = Math.floor(deg / 360), d = (deg - lap * 360) * Math.PI / 180;
    let a = Math.atan2(OC.ry * Math.sin(d), OC.rx * Math.cos(d)) * 180 / Math.PI;
    if (a < 0) a += 360;
    return lap * 360 + a;
  }
  function wedge(a0, a1) {
    if (a1 - a0 >= 359.5) return "M-900 -900H2158V2158H-900Z";
    if (a1 <= a0 + .01) return "M0 0Z";
    let d = `M${OC.cx} ${OC.cy}`;
    for (let a = a0; ; a += 5) {
      const aa = Math.min(a, a1), r = aa * Math.PI / 180, lx = 1700 * Math.cos(r), ly = 1700 * Math.sin(r);
      d += `L${(OC.cx + lx * OU[0] + ly * OV[0]).toFixed(1)} ${(OC.cy + lx * OU[1] + ly * OV[1]).toFixed(1)}`;
      if (aa >= a1) break;
    }
    return d + "Z";
  }
  function lqPath(surf, amp, phase) {
    const f = x => (surf - .09 * (x - 626) + amp * Math.sin(x / 245 * 2 * Math.PI + phase)).toFixed(1);
    let d = `M190 1320L190 ${f(190)}`;
    for (let x = 210; x <= 1070; x += 20) d += `L${x} ${f(x)}`;
    return d + "L1070 1320Z";
  }
  const PIECES = [["h", 1.2, 58, 1], ["t1", 7, 40, .42], ["t2", 16, 26, .18]];
  function setComet(R, phi, op) {
    const s = sAt(phi), sn = Math.sin(phi * Math.PI / 180);
    R.comets.forEach(gp => PIECES.forEach(([c, L, w, o]) => {
      const el = gp.querySelector("." + c);
      el.style.strokeDashoffset = (L - s).toFixed(3);
      el.style.strokeWidth = (w * (1 + .16 * sn)).toFixed(1);
      el.style.opacity = (op * o * (1 - .28 * Math.max(0, -sn))).toFixed(3);
    }));
  }
  const REST = 2050, EXIT_AT = 2300, EXIT_DUR = 620, MAX_WAIT = 6000;
  function renderIntro(R, t) {
    const g = seg(t, 0, 900);
    R.glowOp = E.oc(g) * .78;
    R.glow.style.transform = `scale(${(.7 + .3 * E.oc(g)).toFixed(3)})`;
    const od = t < 40 ? -1 : E.ioc(seg(t, 60, 800));
    R.halves.forEach(h => { h.style.opacity = od < 0 ? 0 : 1; h.style.strokeDasharray = `${(Math.max(0, od) * 1000).toFixed(1)} 1000`; });
    R.interior.style.opacity = E.oc(seg(t, 360, 820)).toFixed(3);
    const lv = E.oc(seg(t, 430, 1280));
    R.lq.setAttribute("d", lqPath(E.lerp(1075, 628, lv), E.lerp(24, 3, lv), t / 1000 * 2 * Math.PI * .85));
    const st = t - 1120;
    R.liq.style.transform = st > 0 ? `rotate(${(3.2 * Math.exp(-st / 300) * Math.sin(2 * Math.PI * st / 520)).toFixed(3)}deg)` : "";
    [[R.b1, 960, 1400], [R.b2, 1080, 1520]].forEach(([el, a, b]) => {
      const p = seg(t, a, b);
      el.style.opacity = E.clamp(p * 4).toFixed(3);
      el.style.transform = `translateY(${(70 * (1 - E.oc(p))).toFixed(1)}px) scale(${(p <= 0 ? 0 : Math.max(0, E.ob(p, 2.2))).toFixed(3)})`;
    });
    // 光点从瓶颈后面绕出，一圈画出星环，收尾时又转回瓶颈后面
    const rp = seg(t, 860, 1700), phi0 = 285, phi = phi0 + 360 * E.ioc(rp);
    R.rv.setAttribute("d", wedge(alphaAt(phi0), rp >= 1 ? alphaAt(phi0) + 360 : alphaAt(phi)));
    if (t > REST) setComet(R, phi0 + 360 * (t - REST) / 2400, E.clamp((t - REST) / 300));
    else setComet(R, phi, rp <= 0 || rp >= 1 ? 0 : E.clamp(rp * 10) * E.clamp((1 - rp) * 8));
    const w1 = seg(t, 1250, 1780), w2 = seg(t, 1400, 1950);
    R.title.style.opacity = E.oc(w1).toFixed(3);
    R.title.style.transform = `translateY(${(16 * (1 - E.oc(w1))).toFixed(1)}px)`;
    R.title.style.filter = w1 < 1 ? `blur(${(6 * (1 - w1)).toFixed(2)}px)` : "";
    R.kick.style.opacity = E.oc(w2).toFixed(3);
    R.kick.style.letterSpacing = E.lerp(.62, .32, E.oc(w2)).toFixed(3) + "em";
    const gl = seg(t, 1560, 2080);
    R.glint.setAttribute("transform", `translate(${E.lerp(170, 1110, E.ios(gl)).toFixed(1)} 0) rotate(20 -30 630)`);
    R.glint.setAttribute("opacity", (Math.sin(Math.PI * gl) * .7).toFixed(3));
    R.glow.style.opacity = R.glowOp.toFixed(3);
    R.skip.style.opacity = seg(t, 300, 600).toFixed(3);
  }
  function splashWanted() {
    let q = null;
    try { q = new URLSearchParams(location.search).get("splash"); } catch { /* 无参数 */ }
    if (q === "0") return false;
    if (q === "1") return true;
    if (reducedMotion() || navigator.webdriver) return false;
    try { if (sessionStorage.getItem("masterLab.splashSeen.v1")) return false; } catch { /* 存储不可用时照常播放 */ }
    return true;
  }
  function runSplash() {
    if (!document.body || !splashWanted()) return;
    try { sessionStorage.setItem("masterLab.splashSeen.v1", "1"); } catch { /* 忽略 */ }
    const root = document.documentElement;
    const el = document.createElement("div");
    el.className = "ml-splash";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<div class="ml-splash-bg"></div><div class="ml-splash-center"><div class="ml-splash-logo"><div class="ml-splash-glow"></div><div class="ml-splash-tile"></div><div class="ml-splash-svg">${rig({ geo: "full", split: true, reveal: true, comet: true, glint: true, liquidReveal: true })}</div></div><div class="ml-splash-word"><b>大师实验室</b><span>AI SCIENCE STUDIO</span></div></div><div class="ml-splash-skip">点击任意处跳过</div>`;
    document.body.prepend(el);
    root.classList.add("ml-splashing");
    const svg = el.querySelector(".ml-splash-svg svg"), q = s => svg.querySelector(s), qa = s => [...svg.querySelectorAll(s)];
    const R = {
      bg: el.querySelector(".ml-splash-bg"), logo: el.querySelector(".ml-splash-logo"), glow: el.querySelector(".ml-splash-glow"),
      tile: el.querySelector(".ml-splash-tile"), word: el.querySelector(".ml-splash-word"), title: el.querySelector(".ml-splash-word b"),
      kick: el.querySelector(".ml-splash-word span"), skip: el.querySelector(".ml-splash-skip"),
      halves: qa(".fx-half"), interior: q(".fx-interior"), lq: q(".fx-lq"), rv: q(".fx-rv"), liq: q(".fx-liq-wrap"),
      b1: q(".fx-b1"), b2: q(".fx-b2"), comets: qa(".fx-comet"), glint: q(".fx-glint"), glowOp: 0
    };
    let ready = document.readyState !== "loading";
    document.addEventListener("DOMContentLoaded", () => { ready = true; }, { once: true });
    const t0 = performance.now();
    let exitAt = null, flip = null, target = null, done = false, lastT = 0;
    const finish = () => {
      if (done) return; done = true;
      el.remove(); root.classList.remove("ml-splashing");
      if (target) target.style.opacity = "";
      removeEventListener("pointerdown", skip, true); removeEventListener("keydown", skip, true);
    };
    const startExit = now => {
      if (exitAt !== null) return;
      exitAt = now;
      if (lastT < REST) renderIntro(R, REST);
      el.style.pointerEvents = "none";
      target = document.querySelector(".topbar-logo");
      const tSvg = target && target.querySelector("svg");
      const a = R.logo.getBoundingClientRect(), b = tSvg && tSvg.getBoundingClientRect();
      if (b && b.width > 0 && b.bottom > 0 && b.top < innerHeight) {
        const s = b.width / a.width;
        flip = { dx: b.left + b.width / 2 - a.left - a.width / 2, dy: b.top + b.height / 2 - a.top - a.height / 2, s };
        R.tile.style.borderWidth = (1 / s).toFixed(2) + "px";
        R.tile.style.boxShadow = `0 ${(10 / s).toFixed(1)}px ${(22 / s).toFixed(1)}px rgba(31, 91, 236, .12)`;
      }
    };
    function skip() { startExit(performance.now()); }
    addEventListener("pointerdown", skip, true);
    addEventListener("keydown", skip, true);
    const frame = now => {
      if (done) return;
      try {
        if (exitAt === null) {
          lastT = now - t0;
          renderIntro(R, lastT);
          if ((lastT >= EXIT_AT && ready) || lastT >= MAX_WAIT) startExit(now);
        } else {
          const x = E.clamp((now - exitAt) / EXIT_DUR), e = E.ioc(x);
          if (flip) {
            R.logo.style.transform = `translate(${(flip.dx * e).toFixed(2)}px, ${(flip.dy * e).toFixed(2)}px) scale(${(1 + (flip.s - 1) * e).toFixed(4)})`;
            R.tile.style.opacity = E.oc(seg(x, .3, .85)).toFixed(3);
            const sw = seg(x, .86, 1);
            R.logo.style.opacity = (1 - sw).toFixed(3);
            if (target) target.style.opacity = sw.toFixed(3);
          } else {
            R.logo.style.opacity = (1 - E.oc(x)).toFixed(3);
            R.logo.style.transform = `scale(${(1 - .08 * E.oc(x)).toFixed(4)})`;
          }
          R.glow.style.opacity = (R.glowOp * (1 - seg(x, 0, .35))).toFixed(3);
          R.word.style.opacity = (1 - seg(x, 0, .3)).toFixed(3);
          R.word.style.transform = `translateY(${(10 * seg(x, 0, .3)).toFixed(1)}px)`;
          R.skip.style.opacity = (1 - seg(x, 0, .2)).toFixed(3);
          R.bg.style.opacity = (1 - E.oc(seg(x, .18, 1))).toFixed(3);
          if (x >= 1) { finish(); return; }
        }
      } catch { finish(); return; }
      requestAnimationFrame(frame);
    };
    renderIntro(R, 0);
    requestAnimationFrame(frame);
    setTimeout(finish, 12000);
  }

  window.MasterLabBrandMotion = {
    rig, mount, rampRate, retrigger, reducedMotion, hoverBoost,
    loaderReset, loaderStage, loaderComplete, offlineMark, breakLink, relink
  };
  try { runSplash(); } catch { document.querySelector(".ml-splash")?.remove(); document.documentElement.classList.remove("ml-splashing"); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mount());
  else mount();
})();
