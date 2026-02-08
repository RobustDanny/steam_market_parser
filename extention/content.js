// content.js (minimal)
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const draftId = params.get("tastyrock_draft");
  if (!draftId) return;

  const API_BASE = "http://127.0.0.1:8080";
  const draftUrl = `${API_BASE}/api/offer/draft/${encodeURIComponent(draftId)}`;

  const TR_KEY = "tastyrock_bridge_v1";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fetchDraft() {
    const resp = await chrome.runtime.sendMessage({
      type: "FETCH_TASTYROCK_DRAFT",
      url: draftUrl,
    });
    if (!resp?.ok) throw new Error(resp?.error || "Unknown fetch error");
    return resp.data;
  }

  // ---------- bridge ----------
  let injected = false;
  let readyPromise = null;

  function injectBridgeOnce() {
    if (injected) return;
    injected = true;

    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("page_bridge.js");
    s.async = false;
    (document.head || document.documentElement).appendChild(s);

    s.onload = () => console.log("[TastyRock] page bridge loaded");
    s.onerror = () => console.error("[TastyRock] page_bridge.js load failed");
  }

  function waitForBridgeReady(timeoutMs = 8000) {
    if (readyPromise) return readyPromise;

    readyPromise = new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        window.removeEventListener("message", onMsg);
        reject(new Error("Bridge not ready"));
      }, timeoutMs);

      function onMsg(ev) {
        const msg = ev?.data;
        if (!msg || msg.__tastyrock !== TR_KEY) return;
        if (msg.type !== "BRIDGE_READY") return;

        clearTimeout(t);
        window.removeEventListener("message", onMsg);
        resolve(true);
      }

      window.addEventListener("message", onMsg);
    });

    return readyPromise;
  }

  async function pageCall(type, payload, timeoutMs = 25000) {
    injectBridgeOnce();
    await waitForBridgeReady(8000);

    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        window.removeEventListener("message", onMsg);
        reject(new Error("pageCall timeout"));
      }, timeoutMs);

      function onMsg(ev) {
        const msg = ev?.data;
        if (!msg || msg.__tastyrock !== TR_KEY) return;
        if (msg.id !== id) return;

        clearTimeout(t);
        window.removeEventListener("message", onMsg);

        if (msg.ok) resolve(msg.data);
        else reject(new Error(msg.data?.error || "pageCall failed"));
      }

      window.addEventListener("message", onMsg);

      window.postMessage(
        { __tastyrock: TR_KEY, dir: "to_page", id, type, payload },
        "*"
      );
    });
  }

  // ---------- optional UI actions ----------
  function confirmTradeContents() {
    if (typeof window.ToggleReady === "function") {
      console.log("[TastyRock] confirming trade contents");
      window.ToggleReady(true);
      return true;
    }
    return false;
  }
  

  function clickSendOffer() {
    const btn =
      document.querySelector("#tradeoffer_sendbtn") ||
      Array.from(document.querySelectorAll("button, a")).find(
        (n) => (n.textContent || "").trim().toLowerCase() === "send offer"
      );
    if (btn) btn.click();
  }

  // ---------- main ----------
  (async () => {
    try {
      const draft = await fetchDraft();
      console.log("[TastyRock] draft:", draft);

      const give = Array.isArray(draft?.give) ? draft.give : [];
      if (!give.length) {
        console.warn("[TastyRock] no items to add");
        return;
      }

      await pageCall("ADD_GIVE_ITEMS", { give });

      await sleep(300);
      confirmTradeContents();

      // optional: auto send
      if (draft.autosend) {
        await sleep(600);
        clickSendOffer();
      }

      console.log("[TastyRock] done", draftId);
    } catch (e) {
      console.error("[TastyRock] failed", e);
    }
  })();
})();
