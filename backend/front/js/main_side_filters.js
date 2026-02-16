import { sticky_tooltip } from "./misc_shared_fns.js";
import { sendMainWS } from "./main_websocket_handler.js";

//--------------------
//--------------------
//Tooltip

const apply_btn = document.getElementById("side_panel_apply_filters");
const bureaucracy_icon = document.getElementById("bureaucracy_icon");
const idea_icon = document.getElementById("idea_icon");
const library_icon = document.getElementById("library_icon");
const main_menu_icon = document.getElementById("side_panel_toggle");
sticky_tooltip(apply_btn);
sticky_tooltip(bureaucracy_icon);
sticky_tooltip(main_menu_icon);
sticky_tooltip(idea_icon);
sticky_tooltip(library_icon);

//--------------------
//--------------------

const sidePanel = document.querySelector(".side_panel");
const toggleBtn = document.getElementById("side_panel_toggle");
const toggleBtnCont = document.getElementById("menu_icon_cont");

toggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  sidePanel.classList.toggle("is_open");
});

toggleBtnCont.addEventListener("click", (e) => {
  e.stopPropagation();
  sidePanel.classList.toggle("is_open");
});

// Optional: click outside to close
document.addEventListener("click", (e) => {
  if (!sidePanel.contains(e.target) && !toggleBtn.contains(e.target)) {
    sidePanel.classList.remove("is_open");
  }
});


function resolveAppIdFromDatalist() {
  const input = document.getElementById("f_appid");
  const list = document.getElementById("game_list_datalist");
  if (!input || !list) return input?.value ?? "";

  const opt = [...list.options].find(o => o.value === input.value);
  return opt?.dataset?.appid || input.value; // fallback if user typed manually
}


apply_btn.addEventListener("click", () => {
  const checkedRadio = document.querySelector('input[name="radio"]:checked');

  const msg = {
    type: "filters",
    appid: resolveAppIdFromDatalist(),
    price_min: document.getElementById("f_min").value,
    price_max: document.getElementById("f_max").value,
    query: document.getElementById("f_query").value,
    card_appearing: checkedRadio.value,
  };

  const url =
    `/api/filters?appid=${encodeURIComponent(msg.appid)}&price_min=${encodeURIComponent(msg.price_min)}&price_max=${encodeURIComponent(msg.price_max)}&query=${encodeURIComponent(msg.query)}&card_appearing=${encodeURIComponent(msg.card_appearing)}`;

  fetch(url).then(res => res.json()).then(json => console.log("Session filters updated:", json));
  sendMainWS(msg);

});

document.addEventListener("DOMContentLoaded", () => {
  const minR = document.getElementById("f_min");
  const maxR = document.getElementById("f_max");
  const minN = document.getElementById("f_min_num");
  const maxN = document.getElementById("f_max_num");

  const MIN = Number(minR.min ?? 0);
  const MAX = Number(minR.max ?? 9999999);

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const toNum = (x) => (Number.isFinite(+x) ? +x : 0);

  function syncFromRanges() {
    let minV = clamp(toNum(minR.value), MIN, MAX);
    let maxV = clamp(toNum(maxR.value), MIN, MAX);

    if (minV > maxV) minV = maxV;

    minR.value = String(minV);
    maxR.value = String(maxV);
    minN.value = String(minV);
    maxN.value = String(maxV);
  }

  function syncFromNumbers() {
    let minV = clamp(toNum(minN.value), MIN, MAX);
    let maxV = clamp(toNum(maxN.value), MIN, MAX);

    if (minV > maxV) minV = maxV;

    minN.value = String(minV);
    maxN.value = String(maxV);
    minR.value = String(minV);
    maxR.value = String(maxV);
  }

  // drag sliders
  minR.addEventListener("input", () => {
    if (+minR.value > +maxR.value) maxR.value = minR.value;
    syncFromRanges();
  });
  maxR.addEventListener("input", () => {
    if (+maxR.value < +minR.value) minR.value = maxR.value;
    syncFromRanges();
  });

  // type numbers
  minN.addEventListener("input", () => {
    if (+minN.value > +maxN.value) maxN.value = minN.value;
    syncFromNumbers();
  });
  maxN.addEventListener("input", () => {
    if (+maxN.value < +minN.value) minN.value = maxN.value;
    syncFromNumbers();
  });

  // init
  syncFromRanges();
});


