import { connectStoreChatWS, sendWS } from "./store_websocket.js";
import { get_inventory_games } from "./shared_fns.js";

document.getElementById("offerList")?.addEventListener("click", () => {
    document.getElementById("offer_listBackdrop").style.display = "flex";
  });
  
document.getElementById("offer_listBackdrop").addEventListener("click", (e) => {
if (e.target.id === "offer_listBackdrop") {
    e.target.style.display = "none";
}
});

document.getElementById("enter_my_store").addEventListener("click", async () => {
    const traderId = document.getElementById("main_steam_id").value;
    const result = await remove_buyer_from_queue(traderId);

    document.getElementById("user_store").style.display = "flex";
    document.getElementById("user_storeBackdrop").style.display = "flex";
    document.getElementById("offer_listBackdrop").style.display = "none";

    const element = document.getElementById("settings_appid_select");
    await get_inventory_games(traderId, element);

    await connectStoreChatWS(result.buyer_id, traderId, "trader");
    sendWS({ type: "system", text: "Trader connected!" });
});


async function remove_buyer_from_queue(store_id) {
    const res = await fetch("/api/remove_from_store_queue", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            store_id: store_id,
        }),
    });

    const json = await res.json();
    console.log("Buyer is removing from the store queue:", json.buyer_id);

    return json;
}