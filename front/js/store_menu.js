// =======================
// THIRD (open menu + enter store + queue + games)
// =======================

import { connectStoreChatWS } from "./store_websocket.js";
import { get_inventory_games } from "./shared_fns.js";
import { renderActionButtons } from "./user_store.js";

document.addEventListener("click", (e) => {
    const card = e.target.closest(".ad_card_from_feed");
    if (!card) return;
  
    // Freeze steamid of the clicked card
    window.selectedStoreSteamId = card.dataset.steamid || null;
  
    document.getElementById("store_menu").style.display = "flex";
    document.getElementById("store_menuBackdrop").style.display = "flex";
  });
  
  document.getElementById("store_menuBackdrop").addEventListener("click", (e) => {
    if (e.target.id !== "store_menuBackdrop") return;
    e.target.style.display = "none";
    document.getElementById("store_menu").style.display = "none";
  });
  
  document.getElementById("enter_store").addEventListener("click", async () => {
    const store_steamid = window.selectedStoreSteamId; // <-- use selected, NOT getElementById
    const buyer_steamid = document.getElementById("main_steam_id").value;
  
    //Need change. Bc store card with no steamID will not exist
    if (!store_steamid) {
      console.warn("No store selected. Click an ad card first.");
      return;
    }

    //If trader click on his store card
    if (store_steamid === buyer_steamid) {
      console.log("Equal");
      return;
    }
  
    console.log("Store Steamid:", store_steamid);
    console.log("Buyer Steamid:", buyer_steamid);
  
    // Put steamid into form hidden input (single input in your form)
    const settingsSteamIdInput = document.getElementById("store_steamid");
    if (settingsSteamIdInput) settingsSteamIdInput.value = store_steamid;
  
    // Show store UI
    document.getElementById("user_store").style.display = "flex";
    document.getElementById("user_storeBackdrop").style.display = "flex";
    document.getElementById("store_menu").style.display = "none";
    document.getElementById("store_menuBackdrop").style.display = "none";
  
    // Queue + games
    add_buyser_to_queue(store_steamid, buyer_steamid);
    const element = document.getElementById("settings_appid_select");
    await get_inventory_games(store_steamid, element);
  
    // Connect chat here (REMOVES need for a second enter_store listener)
    connectStoreChatWS(buyer_steamid, store_steamid, "buyer");
    renderActionButtons();

  });
  
  function add_buyser_to_queue(trader_id, buyer_id) {
    fetch("/api/add_to_store_queue", {
      method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            buyer_id: buyer_id,
            trader_id: trader_id,
        }),
    })
      .then(res => res.json())
      .then(json => console.log("Buyer added to queue:", json))
      .catch(err => console.error("add_to_store_queue error:", err));
  }
  
  const card = document.getElementById("store_rating");
if (card) {
    card.addEventListener("click", go_to_store_rating_page);
}



function go_to_store_rating_page() {
  window.location.href = "http://127.0.0.1:8080/store_rating";
}

