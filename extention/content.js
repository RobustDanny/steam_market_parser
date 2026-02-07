(() => {
    "use strict";
  
    const params = new URLSearchParams(location.search);
    const draftId = params.get("tastyrock_draft");
    if (!draftId) return;
  
    // Local API base
    const API_BASE = "http://127.0.0.1:8080";
    const draftUrl = `${API_BASE}/api/offer/draft/${encodeURIComponent(draftId)}`;
  
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  
    async function fetchDraft() {
      const resp = await chrome.runtime.sendMessage({
        type: "FETCH_TASTYROCK_DRAFT",
        url: draftUrl
      });
      if (!resp?.ok) throw new Error(resp?.error || "Unknown fetch error");
      return resp.data;
    }
  
    // ---------------------------
    // TODO: Implement with Steam DOM
    // ---------------------------
    async function openMyInventory(appid, contextid) {}
    async function clickMyItemByAssetId(assetid) {}
    async function confirmMySelection() {}
    async function clickSendOffer() {}
  
    async function autoSelect(draft) {
      // expected draft: { give:[{appid,contextid,assetid,amount}], autosend:true/false }
      const groups = new Map();
  
      for (const it of (draft.give || [])) {
        const key = `${it.appid}:${it.contextid}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(it);
      }
  
      for (const [key, items] of groups) {
        const [appid, contextid] = key.split(":");
        await openMyInventory(Number(appid), contextid);
        await sleep(300);
  
        for (const it of items) {
          await clickMyItemByAssetId(String(it.assetid));
          await sleep(60);
        }
  
        await confirmMySelection();
        await sleep(500);
      }
  
      if (draft.autosend) {
        await sleep(800);
        await clickSendOffer();
      }
    }
  
    (async () => {
      try {
        const draft = await fetchDraft();
        await autoSelect(draft);
        console.log("[TastyRock] done", draftId);
      } catch (e) {
        console.error("[TastyRock] failed", e);
      }
    })();
  })();
  