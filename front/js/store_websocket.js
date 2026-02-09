import { 
  sticky_tooltip,
  loader,
  ChangeStyleOfElements,
} from "./misc_shared_fns.js";

//--------------------
//--------------------
//Buyer and Trader IDs
let buyer_id = null;
let trader_id = null;

export function checkIDs() {
  // console.log("checkIDs", {buyer_id, trader_id});
  return {buyer_id, trader_id};
}

function setIDs(buyer, trader){
  if(!buyer || !trader) {
    console.error("buyer or trader is empty");
    return;
  }

  buyer_id = buyer;
  trader_id = trader;
  // console.log("setIDs", { buyer_id, trader_id });
  }

function clearIDs(){
  buyer_id = null;
  trader_id = null;
}
//--------------------
//--------------------

//--------------------
//--------------------
//Offer
let currentOfferId = null;

export function checkOfferId(){
  return currentOfferId;
}

async function getOfferID(){
  const {buyer_id, trader_id} = checkIDs();

  // console.log("make_offer payload", { buyer_id, trader_id });

  if (!trader_id) {
    console.error("trader_id is empty. Did you set window.selectedStoreSteamId when opening the store?");
    return;
  }
  if (!buyer_id) {
    console.error("buyer_id is empty (main_steam_id input missing?)");
    return;
  }

  const res = await fetch("/api/offer/make_offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trader_id, buyer_id })
  });

  const data = await res.json();
  currentOfferId = data.offer_id;

  storeChatWS.send(JSON.stringify({ type: "set_offer", offer_id: currentOfferId }));
}

export function clearOfferId() {
  currentOfferId = null;
  console.log("Offer_id cleared" , currentOfferId);
  // window.dispatchEvent(new CustomEvent("offer_id_changed", { detail: { offer_id: null } }));
}

function setOfferId(id) {
  if (id == null) return;
  const s = String(id).trim();
  if (!s) return;

  if (currentOfferId !== s) {
    currentOfferId = s;
    console.log("offer_id updated:", currentOfferId);
    // window.dispatchEvent(new CustomEvent("offer_id_changed", { detail: { offer_id: currentOfferId } }));
  }
}

// simple workflow flags (client-side gating)
let offerSent = false;      // buyer clicked Send (or received offer_items)
let offerAccepted = false;  // trader accepted (or received accept_items)
let offerPaid = false;      // buyer paid (or received pay_offer)
let offerDirty = false;

function OfferConfig(dirty, sent, accepted, paid){
  offerSent = sent;
  offerAccepted = accepted;
  offerPaid = paid;
  offerDirty = dirty;
  console.log("Config Offer", 
  {
    offerAccepted,
    offerDirty,
    offerPaid,
    offerSent
  });
}

//--------------------
//--------------------


//--------------------
//--------------------
//WS

let presence = { count: 0, buyer_present: false, trader_present: false };
let storeChatWS = null;
let myRole = null; // "buyer" | "trader"
let openPromise = null;

export function checkStoreChatWS(){
  return storeChatWS;
}

function bothInRoom() {
  return presence.buyer_present && presence.trader_present;
}

export function connectStoreChatWS(buyerId, traderId, role) {
    myRole = role;

    setIDs(buyerId, traderId);
  
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

        if(!currentOfferId && role === "buyer"){
          getOfferID();
        }

        updateStoreButtons();
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
    
      // 1) Presence from server
      if (msg.type === "presence") {
        presence = {
          count: msg.count ?? 0,
          buyer_present: !!msg.buyer_present,
          trader_present: !!msg.trader_present,
          offer_id: msg.offer_id ?? null
        };
        
        if (msg.offer_id) setOfferId(msg.offer_id);
        else clearOfferId();

        updateStoreButtons();
        return;
      }
    
      // 2) Chat / system
      if (msg.type === "chat" || msg.type === "system") {
        appendChatMessage(msg);
        return;
      }

      if (msg.type === "offer_system") {
        appendChatMessage(msg);
        return;
      }


      // 3) Buyer sent offer items -> mark offerSent on both sides
      if (msg.type === "offer_items") {

        // Your existing logic: ignore rendering if it’s my own offer
        if (msg.from_role === myRole) {
          updateStoreButtons();
          return;
        }
    
        const container = document.querySelector(".store_selected_items_list");
        if (!container) return;
    
        container.innerHTML = "";
        msg.items.forEach(item => {

          container.insertAdjacentHTML("beforeend", `
            <div class="selected_item_card_cont" 
              data-key="${item.key}"
              data-contextid="${item.contextid}"
              data-appid="${item.appid}"
              data-name="${item.name}"
              data-image="${item.image}"
              data-item-link="${item.link}"
              >
              <div class="selected_item_card" >
    
                <button type="button" class="selected_item_remove_btn" title="Remove">
                  ✕
                </button>
    
                <div style="height: 100%; display: grid; place-content: center; box-sizing: border-box;">
                  <img class="selected_item_icon" src="${item.image}" alt="${item.name}">
                </div>
              </div>

              <div class="price_input_wrapper">
                <span class="dollar_sign">$</span>
                <input class="selected_item_price_input" value="${item.price || ""}" placeholder="0">
              </div>
            </div>
          `);

          document
          .querySelectorAll(".card_hover-container.is-selected")
          .forEach(el => el.classList.remove("is-selected"));
        
            // Mark inventory cards that are in the offer
            msg.items.forEach(item => {
              const assetId = item.key.split(":")[2];
              const invCard = document.querySelector(
                `.card_hover-container[data-assetid="${assetId}"]`
              );
              if (invCard) invCard.classList.add("is-selected");
            });

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
        });

        // NOTE: you don't have selected_items_accept_btn id anymore (you render send/accept/pay)
        updateStoreButtons();
        return;
      }
      if(msg.type === "offer_step"){

        const notification_box = document.getElementById("current_offer_data_span");

        if (!bothInRoom()) {
          notification_box.textContent = "Waiting for both participants in room";
          return;
        }

        if (msg.step === "accept") {
          if (myRole === "buyer") {
            notification_box.textContent = "Offer accepted. Now you can pay";
          } else if (myRole === "trader") {
            notification_box.textContent = "Waiting for buyer to pay";
          }
        }

        if(msg.step === "connect"){
          notification_box.textContent = msg.text;
        }

        if(msg.step === "pay"){
          document.querySelector(".store_inventory_list").innerHTML = "";
          document.querySelector(".store_payment_area").style.display = "flex";

          ChangeStyleOfElements([
            document.querySelector(".store_inventory_list"),
            document.querySelectorAll(".selected_item_remove_btn"),
            document.getElementById("store_button_load_inventory"),
            document.getElementById("settings_appid_select")
          ], "display", "none");

          const notification_box = document.querySelector(".selected_items_accept_btn_cont");
          loader(notification_box);

          document.querySelectorAll(".selected_item_price_input").forEach(btn => {
            btn.readOnly = true;
            btn.classList.add("locked");
          });

          // notification_box.textContent = msg.text;
        }
      }

      if (msg.type === "set_offer") {
        // console.log(msg);
        if (msg.offer_id) setOfferId(msg.offer_id);
        // appendChatMessage(msg);
        // updateStoreButtons();
      }

      if (msg.type === "reveal_send_offer"){
        const notification_box = document.getElementById("current_offer_data_span");

        if (myRole === "trader") {
          notification_box.textContent = "";
        
          const btnContainer = document.querySelector(".selected_items_accept_btn_cont");
          btnContainer.innerHTML = "";
        
          btnContainer.insertAdjacentHTML(
            "beforeend",
            `
              <button id="accept_btn" class="selected_items_accept_btn">Send Offer</button>
              <span class="hidden_text_store">Click to send offer to buyer</span>
            `
          );
        
          const btn = document.getElementById("accept_btn");
          btn.disabled = false; // ✅ enable button
          btn.classList.add("is_active");

          const container = document.querySelector(".store_selected_items_list");
          if (!container || container.childElementCount === 0) return;
          const special_for_save_offer = [...container.querySelectorAll(".selected_item_card_cont")].map(el => {
            const priceValue = el.querySelector(".selected_item_price_input")?.value || "0";
          
            return {
              item_asset_id: el.dataset.key,
              item_name: decodeURIComponent(el.dataset.name || ""),
              item_price: priceValue.toString(),
              item_link: decodeURIComponent(el.dataset.itemLink || ""),
              item_image: decodeURIComponent(el.dataset.image || ""),
              item_contextid: el.dataset.contextid,
              item_appid: el.dataset.appid,
            };
          });

          document.querySelector(".selected_items_accept_btn").addEventListener(
            "click",
            async () => {
              // 🔓 open tab immediately (user gesture)
              const steamTab = window.open("about:blank", "_blank");
          
              if (!steamTab) {
                console.error("Popup blocked");
                return;
              }
          
              try {
                const res = await fetch("/api/offer/check_offer_to_pay", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    offer_id: checkOfferId(),
                    special_for_save_offer,
                    partner_steam_id: checkIDs().buyer_id,
                  }),
                });
          
                const data = await res.json();
          
                if (!res.ok || !data?.ok || !data.steam_url) {
                  console.error("check_offer_to_pay failed:", data);
                  steamTab.close();
                  return;
                }
          
                // ✅ redirect the already-opened tab
                steamTab.location.href = data.steam_url;
              } catch (e) {
                console.error("request failed:", e);
                steamTab.close();
              }
            },
            { once: true }
          );
          
        }

        if(myRole === "buyer"){
         
          notification_box.textContent = msg.text;
        }
      }

      if (msg.type === "offer_log"){
        appendChatMessage(msg);
      }

      if (msg.type === "item_asking"){
        appendChatMessage(msg);
      }

      if (msg.type === "send_offer") {
        OfferConfig(msg.offer_dirty, msg.offer_send, msg.offer_accepted, msg.offer_paid);
        updateStoreButtons();
      }
    
      // 4) Trader accepted -> enable Pay for buyer
      if (msg.type === "accept_offer") {
        OfferConfig(msg.offer_dirty, msg.offer_send, msg.offer_accepted, msg.offer_paid);
        updateStoreButtons();
        // optionally append as system/chat message if you want
        return;
      }
    
      // 5) Buyer paid -> lock pay / maybe lock accept/send
      if (msg.type === "pay_offer") {
        OfferConfig(msg.offer_dirty, msg.offer_send, msg.offer_accepted, msg.offer_paid);
        updateStoreButtons();
        return;
      }
    };
    
    storeChatWS.onclose = () => {
      console.log("STORE CHAT WS CLOSED");
      clearOfferId();
      clearIDs();
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

  if (msg.type === "offer_system") {
    const offerSpan = document.createElement("span");
  
    messageEl.className = "chat_message offer_id_message";
    messageEl.textContent = msg.text ?? "";
  
    offerSpan.textContent = "Copy offer ID";
    offerSpan.style.visibility = "hidden"; // valid
    offerSpan.className = "hidden_text_store";
  
    container.appendChild(messageEl);
    container.appendChild(offerSpan);

    messageEl.addEventListener("click", async () => {
      if (!msg.text) return;
  
      try {
        await navigator.clipboard.writeText(msg.text);
        offerSpan.textContent = "Copied ✓";
      } catch {
        offerSpan.textContent = "Copy failed";
      }
    });
  
    sticky_tooltip(messageEl);
    container.scrollTop = container.scrollHeight;
    return;
  }

  function getItemAskingRoleClass(msg) {
    if (msg.from_role === "system") return "chat_item_asking_system";
    if (msg.from_role === myRole) return "chat_item_asking_me";
    return "chat_item_asking_other";
  }
  

  if (msg.type === "item_asking") {
    let data;
    try {
      data = JSON.parse(msg.text);
    } catch {
      return;
    }
  
    messageEl.className =
      "chat_message chat_item_asking " +
      getRoleClass(
        msg,
        "chat_item_asking_me",
        "chat_item_asking_other",
        "chat_item_asking_system"
      );
  
    const img = document.createElement("img");
    img.src = data.image ?? "";
    img.alt = data.name ?? "";
  
    const content = document.createElement("div");
    content.className = "chat_item_asking_content";
  
    const text = document.createElement("span");
    text.className = "chat_item_asking_text";
    text.textContent = data.text ?? "";
  
    const link = document.createElement("a");
    link.href = data.link ?? "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  
    const name = document.createElement("span");
    name.className = "chat_item_asking_name";
    name.textContent = data.name ?? "";
  
    link.appendChild(name);
    content.append(text, link);
  
    messageEl.append(img, content);
  
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
    return;
  }  

  if (msg.type === "offer_log") {
    function formatOfferLog(msg) {

      if (!msg.text) return "";

      // Parse JSON string safely
      let data;
      try {
          data = JSON.parse(msg.text);
      } catch (e) {
          console.error("Failed to parse offer_log JSON", e, msg.text);
          return "";
      }

      const { new_items, removed_items, updated_items, added_items, total_price, total_count } = data.json;

      function renderItems(items) {
        if (!items || !items.length) return "";
    
        return items
            .map(item => `
                <div class="item_link_wrapper" style="display: inline-block; position: relative;">
                    • <a href="${item.item_link}" target="_blank">${item.item_name} ($${item.item_price})</a>
                    <div class="item_tooltip">
                        <img src="${item.item_image}" alt="${item.item_name}" style="max-width: 100px; max-height: 100px;">
                    </div>
                </div>
            `).join("<br>");
    }
    

      let html = `<b>$${total_price || 0}</b><br>${total_count || 0} items<br><br>`;

      // Only include sections if they have items
      if (new_items && new_items.length) {
          html += `${renderItems(new_items)}<br><br>`;
      }
      if (removed_items && removed_items.length) {
          html += `<b>Removed</b><br>${renderItems(removed_items)}<br><br>`;
      }
      if (updated_items && updated_items.length) {
          html += `<b>Updated</b><br>${renderItems(updated_items)}<br><br>`;
      }
      if (added_items && added_items.length) {
          html += `<b>Added</b><br>${renderItems(added_items)}`;
      }

      return html;
  }
    
    const container = document.getElementById("chat_messages");
  
    container.insertAdjacentHTML("beforeend", `
      <div class="chat_message chat_message_offer">
        <div class="offer_log_header">
          <span class="offer_badge">OFFER SENT</span>
          <button class="offer_toggle_btn">Show</button>
        </div>
  
        <div class="offer_log_body">
          ${formatOfferLog(msg)}
        </div>
      </div>
    `);
  
    const offerEl = container.lastElementChild;
  
    initOfferLog(offerEl);

    offerEl.querySelectorAll(".item_link_wrapper > a").forEach(el => sticky_tooltip(el));

    function initOfferLog(el, limit = 140) {
      const body = el.querySelector(".offer_log_body");
      const toggle = el.querySelector(".offer_toggle_btn");
      const text = body.innerText.trim();
    
      if (text.length <= limit) {
        toggle.style.display = "none";
        body.classList.remove("is_collapsed");
        body.classList.add("is_expanded");
        return;
      }
    
      body.classList.add("is_collapsed");
    
      toggle.addEventListener("click", () => {
        const collapsed = body.classList.toggle("is_collapsed");
        body.classList.toggle("is_expanded", !collapsed);
        toggle.textContent = collapsed ? "Show" : "Hide";
      });
    }
  
    container.scrollTop = container.scrollHeight;
    return;
  }
  

  // Chat message: decide if it's mine
  messageEl.className =
  "chat_message " +
  getRoleClass(msg, "chat_message_me", "chat_message_other");


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

function getRoleClass(msg, baseMe, baseOther, baseSystem = null) {
  const fromRole = msg.from_role;

  if (fromRole === "system" && baseSystem) {
    return baseSystem;
  }

  const isMine = myRole && fromRole === myRole;
  return isMine ? baseMe : baseOther;
}


//--------------------
//--------------------

//--------------------
//--------------------
//Buttons update
export function updateStoreButtonsWrapper(){
  updateStoreButtons();
}

function setBtnEnabled(id, enabled) {
  const btn = document.getElementById(id);
  if (!btn) return;

  btn.disabled = !enabled;
  btn.classList.toggle("is_active", enabled);
}

export function getSelectedCount() {
  const cont = document.querySelector(".store_selected_items_list");
  return cont ? cont.querySelectorAll(".selected_item_card_cont").length : 0;
}

function updateStoreButtons() {
  const both = bothInRoom();
  const hasItems = getSelectedCount() > 0;

  // SEND
  setBtnEnabled("send_btn", both && hasItems);

  if (myRole === "buyer") {
    setBtnEnabled("pay_btn", both && offerAccepted && !offerPaid);
  }

  if (myRole === "trader") {
    // 🚨 Accept only if:
    // - both in room
    // - buyer sent offer
    // - trader did NOT change anything
    setBtnEnabled(
      "accept_btn",
      both && offerSent && !offerDirty && !offerAccepted
    );
  }
}

//--------------------
//--------------------
