// =======================
// SECOND (store + chat code)
// =======================

import { sticky_tooltip } from "./shared_fns.js";
import { sendChatMessage, closeStoreChatWS, sendWS } from "./store_websocket.js";

function getChatRole() {
  const buyerSteamid = document.getElementById("main_steam_id").value;
  const storeOwnerSteamid = window.selectedStoreSteamId;

  return storeOwnerSteamid && storeOwnerSteamid !== buyerSteamid
    ? "buyer"
    : "trader";
}

document.getElementById("selected_items_accept_btn").addEventListener("click", () => {
  const container = document.querySelector(".store_selected_items_list");
  if (!container || container.childElementCount === 0) return;

  const items = [...container.querySelectorAll(".selected_item_card_cont")]
    .map(el => ({
      key: el.dataset.key,
      image: el.querySelector("img")?.src,
      price: el.querySelector(".selected_item_price_input")?.value || ""
    }));

  sendWS({
    type: "offer_items",
    items
  });
});



const quitIcon = document.getElementById("quit_store_icon");
sticky_tooltip(quitIcon);

quitIcon.addEventListener("click", () => {
  const role = getChatRole();

  sendWS({
    type: "system",
    text: role === "buyer" ? "Buyer left chat" : "Trader left chat"
  });

  closeStoreChatWS();

  // UI cleanup
  document.getElementById("chat_messages").innerHTML = "";
  document.getElementById("user_storeBackdrop").style.display = "none";
  document.getElementById("user_store").style.display = "none";

  console.log("Store closed, WS disconnected");
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
  <div class="card_hover-container inventory-select"
       data-appid="${desc.appid}"
       data-classid="${asset.classid}"
       data-instanceid="${asset.instanceid}"
       data-assetid="${asset.assetid}"
       data-contextid="${asset.contextid}"
       data-name="${encodeURIComponent(name)}"
       data-image="${encodeURIComponent(icon)}"
       data-market_hash_name="${encodeURIComponent(desc.market_hash_name || "")}">
    <div class="inventory_card">
      <div class="inventory_card_details">
        <div>
          <img class="inventory_item_icon" src="${icon}" alt="${name}">
        </div>
        <span class="hidden-text">${name}</span>

        <div class="store_inventory_hidden_buttons">
          <div class="store_inventory_card_backdrop">
            <div class="store_inventory_buttons_column">
              <div class="store_inventory_buttons_row">
                <div class="store_inventory_remove_from_offer">
                  <img class="store_inventory_button store_inventory_remove_from_offer_btn"
                       src="/front/svg/remove_icon.svg">
                  <span class="store_inventory_hidden_button_text">Remove from offer</span>
                </div>

                <div class="store_inventory_check_steam">
                  <a href="https://steamcommunity.com/market/listings/${desc.appid}/${desc.market_hash_name}"
                     target="_blank" rel="noopener noreferrer">
                    <img class="store_inventory_button"
                         src="/front/svg/info_icon.svg">
                  </a>
                  <span class="store_inventory_hidden_button_text">Check price</span>
                </div>
              </div>

              <div class="store_inventory_buttons_row">
                <div class="store_inventory_add_to_offer">
                  <img class="store_inventory_button store_inventory_add_to_offer_btn"
                       src="/front/svg/add_to_offer_icon.svg">
                  <span class="store_inventory_hidden_button_text">Add to offer</span>
                </div>

                <div class="store_inventory_sent_to_chat">
                  <img class="store_inventory_button"
                       src="/front/svg/ask_tader_icon.svg">
                  <span class="store_inventory_hidden_button_text">Ask trader</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
`;


    container.insertAdjacentHTML("beforeend", card);

    // container.querySelectorAll(".store_inventory_button").forEach(btn => {
    //   sticky_tooltip(btn);
    // });
    
    const inventoryContainer = document.getElementById("store_inventory");
    const selectedContainer =
      document.getElementById("store_selected_items_list") ||
      document.querySelector(".store_selected_items_list");

function decode(s) {
  try { return decodeURIComponent(s || ""); } catch { return s || ""; }
}

function makeSelectedCard(item) {
  // item: { key, name, image }
  return `
  <div class="selected_item_card_cont" data-key="${item.key}">
    <div class="selected_item_card" >

      <button type="button" class="selected_item_remove_btn" title="Remove">
        ✕
      </button>

      <div style="height: 100%; display: grid; place-content: center;">
        <img class="selected_item_icon" src="${item.image}" alt="${item.name}">
      </div>
    </div>

    <div>
        <input class="selected_item_price_input" placeholder="$">
    </div>
    </div>
  `;
}

inventoryContainer.addEventListener("click", (e) => {
  // ADD TO OFFER
  const addBtn = e.target.closest(".store_inventory_add_to_offer_btn");
  if (addBtn) {
    const card = e.target.closest(".card_hover-container");
    if (!card || !selectedContainer) return;

    const key = `${card.dataset.appid}:${card.dataset.contextid}:${card.dataset.assetid}`;
    const name = decode(card.dataset.name);
    const image = decode(card.dataset.image);

    // prevent duplicates
    if (selectedContainer.querySelector(`[data-key="${CSS.escape(key)}"]`)) {
      return;
    }
    selectedContainer.insertAdjacentHTML("beforeend", makeSelectedCard({ key, name, image }));
    checkSelectedItemsCount(selectedContainer);
    return;
  }

  // (Optional) REMOVE FROM OFFER button in inventory (if you want it to remove from selected)
  const removeBtn = e.target.closest(".store_inventory_remove_from_offer_btn");
  if (removeBtn) {
    const card = e.target.closest(".card_hover-container");
    if (!card || !selectedContainer) return;
    const key = `${card.dataset.appid}:${card.dataset.contextid}:${card.dataset.assetid}`;
    const selected = selectedContainer.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (selected) selected.remove();
    checkSelectedItemsCount(selectedContainer);
    return;
  }
});

function checkSelectedItemsCount(element){
    if(element.childElementCount !== 0){
        document.getElementById("selected_items_accept_btn").style.background = "#28a4c6";
    }
    else{
      document.getElementById("selected_items_accept_btn").style.background = "#909192";
    }
};

// Remove from selected list
selectedContainer?.addEventListener("click", (e) => {
  const rm = e.target.closest(".selected_item_remove_btn");
  if (!rm) return;
  const selectedCard = e.target.closest(".selected_item_card_cont");
  if (selectedCard) selectedCard.remove();
  checkSelectedItemsCount(selectedContainer);
});


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
