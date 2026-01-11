// =======================
// SECOND (store + chat code)
// =======================

import { sticky_tooltip } from "./shared_fns.js";
import { sendChatMessage } from "./store_websocket.js";

const quitIcon = document.getElementById("quit_store_icon");
sticky_tooltip(quitIcon);

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
