import { sticky_tooltip } from "./misc_shared_fns.js";
import { 
  sendChatMessage, 
  closeStoreChatWS, 
  sendWS, 
  clearOfferId,
  checkIDs,
  updateStoreButtonsWrapper,
  getSelectedCount,
  checkStoreChatWS,
  checkOfferId,
} from "./store_websocket.js";
import { startBtcPay } from "./payments/bitcoin.js";

//--------------------
//--------------------
//Tooltips

const load_store = document.getElementById("reload_store");
const quitIcon = document.getElementById("quit_store_icon");
sticky_tooltip(load_store);
sticky_tooltip(quitIcon);

//--------------------
//--------------------



//--------------------
//--------------------
//Chat and btns

function getChatRole() {
  const mainID = (document.getElementById("main_steam_id")?.value || "").trim();
  const { buyer_id, trader_id } = checkIDs();

  if (!mainID || !trader_id) return "buyer"; // safe fallback

  return mainID === trader_id ? "trader" : "buyer";
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
  const mainID = document.getElementById("main_steam_id").value;
  const button_cont = document.querySelector(".selected_items_accept_btn_cont");
  if (!button_cont) return;

  button_cont.innerHTML = ""; // IMPORTANT: clear old buttons

  const role = getChatRole();

  if (role === "buyer") {
    button_cont.insertAdjacentHTML("beforeend", `
      <div class="selected_items_button_group">
        <div class="selected_items_accept_btn_cont">
        <button id="send_btn" class="selected_items_accept_btn">Send</button>
        <span class="hidden_text_store">Send offer. You can change amount of items and their price</span>
        </div>
        <div class="selected_items_accept_btn_cont">
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
    document.getElementById("pay_btn")?.addEventListener("click", async () => {
      document.querySelector(".store_inventory_area").innerHTML = "";
      sendWS({ type: "offer_step_paying"});
      renderPayOptions();
      await paidOffer();
    });
    
  } else {
    button_cont.insertAdjacentHTML("beforeend", `
      <div class="selected_items_button_group">
      <div class="selected_items_accept_btn_cont">
        <button id="send_btn" class="selected_items_accept_btn">Send</button>
        <span class="hidden_text_store">Send offer. You can change amount of items and their price</span>
      </div>
      <div class="selected_items_accept_btn_cont">
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
    selected: checkIDs().trader_id,
    role: getChatRole()
  });
  
}

async function sendItems() {
  const container = document.querySelector(".store_selected_items_list");
  if (!container || container.childElementCount === 0) return;

  const items = [...container.querySelectorAll(".selected_item_card_cont")].map(el => {
    const priceValue = el.querySelector(".selected_item_price_input")?.value || "0";
  
    const name = (() => { try { return decodeURIComponent(el.dataset.name || ""); } catch { return el.dataset.name || ""; }})();
    const link = (() => { try { return decodeURIComponent(el.dataset.itemLink || ""); } catch { return el.dataset.itemLink || ""; }})();
  
    return {
      key: el.dataset.key,
      image: el.querySelector("img")?.src,
      price: Number(priceValue) || 0,
      name,
      link,
    };
  });

  const special_for_update_offer = [...container.querySelectorAll(".selected_item_card_cont")].map(el => {
    const priceValue = el.querySelector(".selected_item_price_input")?.value || "0";
  
    return {
      item_asset_id: el.dataset.key,
      item_name: decodeURIComponent(el.dataset.name || ""),
      item_price: priceValue.toString(),
      item_link: decodeURIComponent(el.dataset.itemLink || ""),
      item_image: decodeURIComponent(el.dataset.image || "")
    };
  });
  console.log("special_for_update_offer", special_for_update_offer);
  const offer_id = checkOfferId();

  const res = await fetch("/api/offer/update_offer", {
    method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
    body: JSON.stringify({
      offer_id,
      special_for_update_offer
    })
  });

  if (!res.ok) {
    console.error("update_offer failed", await res.text());
    return;
  }
  
  const json = await res.json();
  
  sendWS({ type: "offer_items", items });
  sendWS({ type: "offer_log", json });
  sendWS({ type: "send_offer"});
}

//--------------------
//--------------------



//--------------------
//--------------------
//Quit

quitIcon.addEventListener("click", () => {
  clearOfferId();
  sendWS({ type: "clear_offer" });

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

//--------------------
//--------------------



//--------------------
//--------------------
//Render Inventory
document.getElementById("store_filters_form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;

  const buyerSteamid = checkIDs().buyer_id;
  const steamid = checkIDs().trader_id || buyerSteamid;
  console.log("Render inventory buyer: {} store: {}", buyerSteamid, steamid);

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

  if (!res.ok) {
    const text = await res.text();
    console.error("Inventory load failed:", text);
    return;
  }
  
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

    const card = 
    `
      <div class="card_hover-container inventory-select"
          data-appid="${desc.appid}"
          data-classid="${asset.classid}"
          data-instanceid="${asset.instanceid}"
          data-assetid="${asset.assetid}"
          data-contextid="${asset.contextid}"
          data-name="${encodeURIComponent(name)}"
          data-image="${encodeURIComponent(icon)}"
          data-market_hash_name="${encodeURIComponent(desc.market_hash_name || "")}"
          data-item_link="https://steamcommunity.com/market/listings/${desc.appid}/${desc.market_hash_name}"
          >
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
    
    const inventoryContainer = document.getElementById("store_inventory");
    const selectedContainer =
      document.getElementById("store_selected_items_list") ||
      document.querySelector(".store_selected_items_list");

  function decode(s) {
    try { return decodeURIComponent(s || ""); } catch { return s || ""; }
  }

  function makeSelectedCard(item) {
    return `
      <div class="selected_item_card_cont"
        data-key="${item.key}"
        data-name="${encodeURIComponent(item.name || "")}"
        data-image="${item.image}"
        data-item-link="${encodeURIComponent(item.link || "")}"
      >
        <div class="selected_item_card">
          <button type="button" class="selected_item_remove_btn" title="Remove">✕</button>
  
          <div style="height: 100%; display: grid; place-content: center;">
            <img class="selected_item_icon" src="${item.image}" alt="${item.name || ""}">
          </div>
        </div>
  
        <div class="price_input_wrapper">
          <span class="dollar_sign">$</span>
          <input class="selected_item_price_input" placeholder="0">
        </div>
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
      const link = card.dataset.item_link || ""; 

      if (selectedContainer.querySelector(`[data-key="${CSS.escape(key)}"]`)) return;

      selectedContainer.insertAdjacentHTML("beforeend", makeSelectedCard({ key, name, image, link }));

      card.classList.add("is-selected");
      updateStoreButtonsWrapper(); 
      return;
    }

    const removeBtn = e.target.closest(".store_inventory_remove_from_offer_btn");
    if (removeBtn) {
      const card = e.target.closest(".card_hover-container");
      if (!card || !selectedContainer) return;

      const key = `${card.dataset.appid}:${card.dataset.contextid}:${card.dataset.assetid}`;
      const selected = selectedContainer.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (selected) selected.remove();
      card.classList.remove("is-selected");
      updateStoreButtonsWrapper(); 
      return;
    }
  });

  // Remove from selected list (✕)
  selectedContainer?.addEventListener("click", (e) => {
    const rm = e.target.closest(".selected_item_remove_btn");
    if (!rm) return;

    const selectedCard = e.target.closest(".selected_item_card_cont");
    if (selectedCard) selectedCard.remove();

    const key = selectedCard.dataset.key;
    const assetId = key.split(":")[2];
    const invCard = document.querySelector(
      `.card_hover-container[data-assetid="${assetId}"]`
    );
    if (invCard) invCard.classList.remove("is-selected");

    updateStoreButtonsWrapper();
  });

  // Price edit
  document.addEventListener("input", function(e) {
    if (e.target.classList.contains("selected_item_price_input")) {
      let value = e.target.value;
  
      // Only allow numbers like 5, 5.5, 12, 0.5 is invalid
      if (!/^\d*\.?\d*$/.test(value)) {
        // Remove last typed invalid character
        e.target.value = value.slice(0, -1);
      }
    }

  updateStoreButtonsWrapper();

  });



  // Remove from selected list
  selectedContainer?.addEventListener("click", (e) => {
    const rm = e.target.closest(".selected_item_remove_btn");
    if (!rm) return;
    const selectedCard = e.target.closest(".selected_item_card_cont");
    if (selectedCard) selectedCard.remove();
  });

  selectedContainer?.addEventListener("input", (e) => {
    if (!e.target.classList.contains("selected_item_price_input")) return;
  });

  });
}


function markInventorySelected(key) {
  const inv = document.querySelector(
    `.card_hover-container[data-assetid="${key.split(":")[2]}"]`
  );
  if (inv) inv.classList.add("is-selected");
}

function unmarkInventorySelected(key) {
  const inv = document.querySelector(
    `.card_hover-container[data-assetid="${key.split(":")[2]}"]`
  );
  if (inv) inv.classList.remove("is-selected");
}

//--------------------
//--------------------



//--------------------
//--------------------
//Filter inventory

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

//--------------------
//--------------------



//--------------------
//--------------------
//Offer action btns

async function acceptOffer() {
  if (!checkStoreChatWS() || checkStoreChatWS().readyState !== WebSocket.OPEN) return;
  
  const offer_id = checkOfferId();
  await fetch("/api/offer/update_status_offer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
    offer_id,
    status: "ACCEPTED",
    })
  })

  sendWS({ type: "accept_offer", text: "Trader accept offer"});
  sendWS({ type: "system", text: "Trader's accepted offer" });
  sendWS({ type: "offer_step_accepting"});
  updateStoreButtonsWrapper();
}

async function paidOffer() {
  if (!checkStoreChatWS() || checkStoreChatWS().readyState !== WebSocket.OPEN) return;

  const offer_id = checkOfferId();
  await fetch("/api/offer/update_status_offer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
    offer_id,
    status: "PAY PROCESS",
    })
  })

  sendWS({ type: "paid_offer", text: "Buyer paid offer" });
  updateStoreButtonsWrapper();
}

//--------------------
//--------------------
