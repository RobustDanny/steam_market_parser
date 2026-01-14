let storeChatWS = null;
let myRole = null; // "buyer" | "trader"
let openPromise = null;

function handleWSMessage(data) {
  if (data.type === "offer_items") {
    const role = getChatRole();

    // Buyer sends → trader receives
    if (role === "trader") {
      const container = document.querySelector(".store_selected_items_list");
      container.innerHTML = "";

      data.items.forEach(item => {
        container.insertAdjacentHTML("beforeend", makeSelectedCard({
          key: item.key,
          image: item.image,
          name: "Item"
        }));
      });

      checkSelectedItemsCount(container);
    }
  }
}

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
      const msg = JSON.parse(event.data);
    
      if (msg.type === "chat" || msg.type === "system") {
        appendChatMessage(msg);
        return;
      }
    
      if (msg.type === "offer_items") {
        if (msg.from_role === myRole) return;
    
        const container = document.querySelector(".store_selected_items_list");
        if (!container) return;
    
        container.innerHTML = "";
    
        msg.items.forEach(item => {
          container.insertAdjacentHTML("beforeend", `
            <div class="selected_item_card_cont" data-key="${item.key}">
              <div class="selected_item_card" >
                <div style="height: 100%; display: grid; place-content: center;">
                  <img class="selected_item_icon" src="${item.image}" alt="${item.name}">
                </div>
              </div>

              <div>
                  <input class="selected_item_price_input" value="${item.price || ""}">
              </div>
            </div>
          `);
        });
    
        document.getElementById("selected_items_accept_btn").style.background = "#28a4c6";
      }
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

function handleOfferItems(msg) {
  // Only the OTHER side should render
  if (msg.from_role === myRole) return;

  const container = document.querySelector(".store_selected_items_list");
  if (!container) return;

  container.innerHTML = "";

  msg.items.forEach(item => {
    container.insertAdjacentHTML("beforeend", `
      <div class="selected_item_card_cont" data-key="${item.key}">
        <div class="selected_item_card">
          <div style="height: 100%; display: grid; place-content: center;">
            <img class="selected_item_icon" src="${item.image}">
          </div>
        </div>
        <div>
          <input class="selected_item_price_input" value="${item.price || ""}" disabled>
        </div>
      </div>
    `);
  });

  document.getElementById("selected_items_accept_btn").style.background = "#28a4c6";
}
