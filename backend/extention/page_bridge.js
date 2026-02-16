// page_bridge.js  (runs in Steam PAGE context, can access GTradeStateManager)
(() => {
    "use strict";
  
    const TR_KEY = "tastyrock_bridge_v1";
  
    function reply(id, ok, data) {
      window.postMessage({ __tastyrock: TR_KEY, id, ok, data }, "*");
    }
  
    async function waitForReady(timeoutMs = 25000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (window.GTradeStateManager?.SetItemInTrade && window.g_rgCurrentTradeStatus?.me) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    }
  
    function addGiveItems(give) {
      const mgr = window.GTradeStateManager;
      if (!mgr?.SetItemInTrade) throw new Error("GTradeStateManager.SetItemInTrade missing");
  
      for (const it of (give || [])) {
        const item = {
          appid: Number(it.appid),
          contextid: String(it.contextid),
          id: String(it.assetid),      // IMPORTANT: id == assetid
          is_their_item: false,
        };
  
        mgr.SetItemInTrade(item, 0, Number(it.amount) || 1);
      }
  
      const meAssets = window.g_rgCurrentTradeStatus?.me?.assets || [];
      return { meAssets };
    }
  
    // Listen for messages from content script
    window.addEventListener("message", async (ev) => {
      const msg = ev?.data;
      if (!msg || msg.__tastyrock !== TR_KEY || msg.dir !== "to_page") return;
  
      const { id, type, payload } = msg;
  
      try {
        if (type === "ADD_GIVE_ITEMS") {
          const timeoutMs = payload?.timeoutMs ?? 25000;
          const ready = await waitForReady(timeoutMs);
          if (!ready) throw new Error("Trade manager not ready in page context");
  
          const res = addGiveItems(payload?.give || []);
          await new Promise((r) => setTimeout(r, 250)); // allow UI redraw
  
          reply(id, true, res);
          return;
        }
  
        throw new Error("Unknown bridge message type: " + type);
      } catch (e) {
        reply(id, false, { error: String(e) });
      }
    });
  
    // Optional: debug ping so you know bridge loaded
    window.postMessage({ __tastyrock: TR_KEY, type: "BRIDGE_READY" }, "*");
  })();
  