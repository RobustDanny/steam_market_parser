let storeChatWS = null;
let myRole = null; // "buyer" | "trader"
let openPromise = null;

export function connectStoreChatWS(buyerId, traderId, role) {
    myRole = role;
  
    // Already open -> resolve immediately
    if (storeChatWS && storeChatWS.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
  
    // Already connecting -> return existing promise
    if (storeChatWS && storeChatWS.readyState === WebSocket.CONNECTING && openPromise) {
      return openPromise;
    }
  
    const wsUrl = `ws://127.0.0.1:8080/ws/chat?buyer=${buyerId}&trader=${traderId}&role=${role}`;
    storeChatWS = new WebSocket(wsUrl);
  
    openPromise = new Promise((resolve, reject) => {
      storeChatWS.onopen = () => {
        console.log("STORE CHAT WS CONNECTED");
        resolve();
      };
  
      storeChatWS.onerror = (e) => {
        console.error("STORE CHAT WS ERROR", e);
        reject(e);
      };
    });
  
    // keep your existing message handler
    storeChatWS.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        appendChatMessage({ type: "system", text: event.data });
        return;
      }
      appendChatMessage(msg);
    };
  
    storeChatWS.onclose = () => {
      console.log("STORE CHAT WS CLOSED");
      storeChatWS = null;
      openPromise = null;
    };
  
    return openPromise;
  }

export function sendChatMessage() {
  if (!storeChatWS || storeChatWS.readyState !== WebSocket.OPEN) {
    console.warn("WS not connected");
    return;
  }

  const input = document.getElementById("chat_input");
  const text = input.value.trim();
  if (!text) return;

  storeChatWS.send(JSON.stringify({ type: "chat", text }));
  input.value = "";

  // IMPORTANT: don't optimistic-append (or you'll get duplicates)
  // appendChatMessage({type:"chat", from_role: myRole, text});
}

export function appendChatMessage(msg) {
  const container = document.getElementById("chat_messages");

  const messageEl = document.createElement("div");

  // System message
  if (msg.type === "system" || msg.from_role === "system") {
    messageEl.className = "chat_message chat_message_system";
    messageEl.textContent = msg.text ?? "";
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
    return;
  }

  // Chat message: decide if it's mine
  const fromRole = msg.from_role; // "buyer" | "trader"
  const isMine = myRole && fromRole === myRole;

  messageEl.className = isMine
    ? "chat_message chat_message_me"
    : "chat_message chat_message_other";

  messageEl.textContent = msg.text ?? "";
  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;
}

export function sendWS(payload) {
    if (!storeChatWS || storeChatWS.readyState !== WebSocket.OPEN) {
      console.warn("WS not connected (send skipped)");
      return;
    }
    storeChatWS.send(JSON.stringify(payload));
}

export function closeStoreChatWS() {
  if (!storeChatWS) return;

  if (
    storeChatWS.readyState === WebSocket.OPEN ||
    storeChatWS.readyState === WebSocket.CONNECTING
  ) {
    console.log("Closing STORE CHAT WS...");
    storeChatWS.close(1000, "User quit store");
  }

  storeChatWS = null;
  openPromise = null;
  myRole = null;
}