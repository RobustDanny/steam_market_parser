// =======================
// SECOND (store + chat code)
// =======================

import { sticky_tooltip } from "./shared_fns.js";
import { 
  sendChatMessage, 
  closeStoreChatWS, 
  sendWS, 
  acceptOffer, 
  paidOffer, 
  markOfferDirty, 
  markOfferSent, 
  refreshStoreButtons,
  updateStoreButtonsWrapper,
  getSelectedCount,
  getOfferId,
  clearOfferId 
} from "./store_websocket.js";
import { startBtcPay } from "./payments/bitcoin.js";

let offer_id = null;

function getBuyerSteamid() {
  return (document.getElementById("main_steam_id")?.value || "").trim();
}

function getStoreOwnerSteamid() {
  
  return (window.selectedStoreSteamId || "").trim();
}

function getChatRole() {
  const buyer = getBuyerSteamid();
  const store = getStoreOwnerSteamid();
  return store && store !== buyer ? "buyer" : "trader";
}

function renderPayOptions(){
  const cont = document.querySelector(".store_inventory_area");
  cont.insertAdjacentHTML("beforeend", `
    <div class="store_payment_grid">
      <div class="store_payment_card" id="pay_stripe">
        <img src="/front/svg/payments/stripe.svg" alt="Stripe">
      </div>
      <div class="store_payment_card" id="pay_btc">
        <img src="/front/svg/payments/bitcoin.svg" alt="Bitcoin">
      </div>
    </div>

    <div id="btc_pay_panel" style="margin-top:12px;"></div>
  `);

  document.getElementById("pay_btc").addEventListener("click", startBtcPay);
}

export function renderActionButtons() {
  const button_cont = document.querySelector(".selected_items_accept_btn_cont");
  if (!button_cont) return;

  button_cont.innerHTML = ""; // IMPORTANT: clear old buttons

  const role = getChatRole();

  if (role === "buyer") {
    button_cont.insertAdjacentHTML("beforeend", `
      <div class="selected_items_button_group">
        <div>
        <button id="send_btn" class="selected_items_accept_btn">Send</button>
        <span class="hidden_text_store">Send offer. You can change amount of items and their price</span>
        </div>
        <div>
        <button id="pay_btn" class="selected_items_accept_btn">Pay</button>
        <span class="hidden_text_store">Pay offer. This action valid only when trader accepted your offer</span>
        </div>
      </div>
    `);

    const send_btn = document.getElementById("send_btn");
    const pay_btn = document.getElementById("pay_btn");
    sticky_tooltip(send_btn);
    sticky_tooltip(pay_btn);

    document.getElementById("send_btn").onclick = sendItems;
    document.getElementById("pay_btn")?.addEventListener("click", () => {
      document.querySelector(".store_inventory_area").innerHTML = "";
      document.querySelector(".selected_items_accept_btn_cont").innerHTML = "";
      renderPayOptions();
      paidOffer();
    });
    
  } else {
    button_cont.insertAdjacentHTML("beforeend", `
      <div class="selected_items_button_group">
      <div>
        <button id="send_btn" class="selected_items_accept_btn">Send</button>
        <span class="hidden_text_store">Send offer. You can change amount of items and their price</span>
      </div>
      <div>
        <button id="accept_btn" class="selected_items_accept_btn">Accept</button>
        <span class="hidden_text_store">Accept offer. Buyer will able to pay only after accepting offer</span>
      </div>
      </div>
    `);

    const send_btn = document.getElementById("send_btn");
    const accept_btn = document.getElementById("accept_btn");
    sticky_tooltip(send_btn);
    sticky_tooltip(accept_btn);

    document.getElementById("send_btn").onclick = sendItems;
    document.getElementById("accept_btn")?.addEventListener("click", () => {
      acceptOffer();
    });
 
  }

  console.log("ROLE DEBUG", {
    main: document.getElementById("main_steam_id").value,
    selected: window.selectedStoreSteamId,
    role: getChatRole()
  });
  
}

const load_store = document.getElementById("reload_store");
sticky_tooltip(load_store);

async function sendItems() {
  const container = document.querySelector(".store_selected_items_list");
  if (!container || container.childElementCount === 0) return;

  const items = [...container.querySelectorAll(".selected_item_card_cont")].map(el => {
    const priceValue = el.querySelector(".selected_item_price_input")?.value || "0";
    return {
      key: el.dataset.key,
      image: el.querySelector("img")?.src,
      price: Number(priceValue) || 0
    };
  });

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const countItems = getSelectedCount();

  if(!getOfferId()){
    const offer_id = setOfferID();
  }
  else{
    console.log("Offer_id is EXIST!", getOfferId());
  }

  sendWS({ type: "offer_items", items, totalPrice });

  sendWS({
    type: "chat",
    text: `Offer price: $${totalPrice}\nCount: ${countItems}`
  });

  markOfferSent();
}

async function setOfferID(){
  const store_id = getStoreOwnerSteamid();
  const buyer_id = getBuyerSteamid();

  console.log("make_offer payload", { store_id, buyer_id });

  if (!store_id) {
    console.error("store_id is empty. Did you set window.selectedStoreSteamId when opening the store?");
    return;
  }
  if (!buyer_id) {
    console.error("buyer_id is empty (main_steam_id input missing?)");
    return;
  }

  const res = await fetch("/api/offer/make_offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store_id, buyer_id })
  });

  // if (!res.ok) {
  //   const text = await res.text().catch(() => "");
  //   console.error("make_offer failed", res.status, text);
  //   return;
  // }

  // backend returns UUID as plain string
  const data = await res.json();        // ✅
  offer_id = (data.offer_id || "").trim();

  sendWS({ type: "set_offer_id", offer_id});

  return offer_id;
}

const quitIcon = document.getElementById("quit_store_icon");
sticky_tooltip(quitIcon);

quitIcon.addEventListener("click", () => {
  clearOfferId();
  sendWS({ type: "clear_offer_id" });

  const role = getChatRole();

  sendWS({
    type: "system",
    text: role === "buyer" ? "Buyer left chat" : "Trader left chat"
  });

  closeStoreChatWS();

  // UI cleanup
  const inv_cont = document.querySelector(".store_inventory_area");
  inv_cont.innerHTML = "";
  inv_cont.insertAdjacentHTML("beforeend", `
    <div id="inventory_input_group" class="inventory_input_group">
        <input class="store_input" type="text" id="store_inventoryFilter" placeholder="Search items...">
    </div>
    <div id="store_inventory" class="store_inventory_list">
        <span class="store_no_items_span">No items yet</span>
    </div>
  `);

  const inv_selected_cont = document.querySelector(".store_selected_items_list");
  inv_selected_cont.innerHTML = "";

  document.getElementById("chat_messages").innerHTML = "";
  document.getElementById("user_storeBackdrop").style.display = "none";
  document.getElementById("user_store").style.display = "none";

  console.log("Store closed, WS disconnected");
  updateStoreButtonsWrapper();
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

        <input class="selected_item_price_input" placeholder="$">
    </div>
  `;
}

inventoryContainer.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".store_inventory_add_to_offer_btn");
  if (addBtn) {
    const card = e.target.closest(".card_hover-container");
    if (!card || !selectedContainer) return;

    const key = `${card.dataset.appid}:${card.dataset.contextid}:${card.dataset.assetid}`;
    const name = decode(card.dataset.name);
    const image = decode(card.dataset.image);

    if (selectedContainer.querySelector(`[data-key="${CSS.escape(key)}"]`)) return;

    selectedContainer.insertAdjacentHTML("beforeend", makeSelectedCard({ key, name, image }));
    markOfferDirty(); // ✅
    refreshStoreButtons(); 
    return;
  }

  const removeBtn = e.target.closest(".store_inventory_remove_from_offer_btn");
  if (removeBtn) {
    const card = e.target.closest(".card_hover-container");
    if (!card || !selectedContainer) return;

    const key = `${card.dataset.appid}:${card.dataset.contextid}:${card.dataset.assetid}`;
    const selected = selectedContainer.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (selected) selected.remove();

    markOfferDirty(); // ✅
    refreshStoreButtons(); 
    return;
  }
});

// Remove from selected list (✕)
selectedContainer?.addEventListener("click", (e) => {
  const rm = e.target.closest(".selected_item_remove_btn");
  if (!rm) return;

  const selectedCard = e.target.closest(".selected_item_card_cont");
  if (selectedCard) selectedCard.remove();

  markOfferDirty(); // ✅
  refreshStoreButtons();
});

// Price edit
selectedContainer?.addEventListener("input", (e) => {
  if (!e.target.classList.contains("selected_item_price_input")) return;
  markOfferDirty(); // ✅
  refreshStoreButtons();
});

// Remove from selected list
selectedContainer?.addEventListener("click", (e) => {
  const rm = e.target.closest(".selected_item_remove_btn");
  if (!rm) return;
  const selectedCard = e.target.closest(".selected_item_card_cont");
  if (selectedCard) selectedCard.remove();
  markOfferDirty();
});

selectedContainer?.addEventListener("input", (e) => {
  if (!e.target.classList.contains("selected_item_price_input")) return;
  markOfferDirty();
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
