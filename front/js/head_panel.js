import { get_inventory_games } from "./sticky_tooltip.js";

document.getElementById("ad_me").addEventListener("click", async (e) => {

    const store_steamid = document.getElementById("main_steam_id").value;
    console.log("HEH!!!");
    console.warn("HEH WARN");
    console.error("HEH ERROR");
    const element = document.getElementById("settings_appid_select_user");
    get_inventory_games(store_steamid, element)
});