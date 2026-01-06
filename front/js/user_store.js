// =======================
// SECOND (store + chat code)
// =======================

let storeChatWS = null;

document.getElementById("quit_store_icon").addEventListener("click", () => {
  document.getElementById("user_storeBackdrop").style.display = "none";
  document.getElementById("user_store").style.display = "none";

  if (storeChatWS && storeChatWS.readyState === WebSocket.OPEN) {
    storeChatWS.close(1000, "Done using the connection");
  }
  storeChatWS = null;
});

document.getElementById("store_filters_form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;

  // If user opened someone’s store, use selectedStoreSteamId, else fallback to main user steamid
  const buyerSteamid = document.getElementById("main_steam_id").value;
  const steamid = window.selectedStoreSteamId || buyerSteamid;

  const steamIdInput = document.getElementById("store_steamid");
  if (steamIdInput) steamIdInput.value = steamid;

  const data = new URLSearchParams(new FormData(form));

  const res = await fetch("/api/get_inventory_items", {
    method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
    body: data
  });

  const json = await res.json();
  console.log("Store inventory loaded:", json);

  renderStoreInventory(json);
});

function renderStoreInventory(inventory) {
  const container = document.getElementById("store_inventory");
  container.innerHTML = ""; // clear old inventory

  const assets = inventory.assets || [];
  const descriptions = inventory.descriptions || [];

  const descMap = {};
  descriptions.forEach(d => {
    const key = `${d.classid}_${d.instanceid}`;
    descMap[key] = d;
  });

  assets.forEach(asset => {
    const key = `${asset.classid}_${asset.instanceid}`;
    const desc = descMap[key];
    if (!desc) return;

    const icon = `https://steamcommunity.com/economy/image/${desc.icon_url}`;
    const name = desc.name || "Unknown item";

    const card = `
      <div class="card_hover-container inventory-select" data-image="${icon}">
        <div class="inventory_card">
          <div class="inventory_card_details">
            <div>
              <img class="inventory_item_icon" src="${icon}" alt="${name}">
            </div>
            <span class="hidden-text">${name}</span>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML("beforeend", card);
  });
}

// filter inventory
document.getElementById("store_inventoryFilter").addEventListener("input", function () {
  const query = this.value.trim().toLowerCase();
  const items = document.querySelectorAll("#store_inventory .card_hover-container");

  items.forEach(item => {
    const nameEl = item.querySelector(".hidden-text");
    const name = nameEl ? nameEl.textContent.toLowerCase() : "";
    item.style.display = name.includes(query) ? "" : "none";
  });
});

document.getElementById("chat_send").addEventListener("click", sendChatMessage);

document.getElementById("chat_input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
        sendChatMessage();
    }
});

function sendChatMessage() {
  if (!storeChatWS || storeChatWS.readyState !== WebSocket.OPEN) {
    console.warn("WS not connected");
    return;
  }

  const input = document.getElementById("chat_input");
  const text = input.value.trim();
  if (!text) return;

  storeChatWS.send(JSON.stringify({ type: "chat", text }));
  input.value = "";
}

function appendChatMessage(from, text) {
  const container = document.getElementById("chat_messages");

  const messageEl = document.createElement("div");
  messageEl.className = from === "me"
    ? "chat_message chat_message_me"
    : "chat_message chat_message_other";

  messageEl.textContent = text;

  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;
}

function connectStoreChatWS(buyerId, traderId) {
  if (!buyerId || !traderId) {
    console.warn("Missing buyerId or traderId for chat WS");
    return;
  }
/// Check This out!
  // Close previous if any
  if (storeChatWS && storeChatWS.readyState === WebSocket.OPEN) {
    storeChatWS.close(1000, "Switch store chat");
  }

  const wsUrl = `ws://127.0.0.1:8080/ws/chat?buyer=${buyerId}&trader=${traderId}`;
  storeChatWS = new WebSocket(wsUrl);

    storeChatWS.onopen = () => {
        console.log("STORE CHAT WS CONNECTED");
    };

  storeChatWS.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    appendChatMessage(msg.from, msg.text);
  };

  storeChatWS.onclose = () => {
    console.log("STORE CHAT WS CLOSED");
    storeChatWS = null;
  };

    storeChatWS.onerror = (e) => {
        console.error("STORE CHAT WS ERROR", e);
    };
}
