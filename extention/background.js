chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== "FETCH_TASTYROCK_DRAFT") return;
  
    (async () => {
      try {
        const res = await fetch(msg.url, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });
  
        if (!res.ok) throw new Error(`Draft fetch failed: ${res.status}`);
        const data = await res.json();
  
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
  
    return true;
  });
  