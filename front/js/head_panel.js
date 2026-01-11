import { get_inventory_games } from "./shared_fns.js";

if (document.getElementById("ad_me")){
    document.getElementById("adMeBtn").addEventListener("click", async (e) => {

        const store_steamid = document.getElementById("main_steam_id").value;
        const element = document.getElementById("settings_appid_select_user");
        get_inventory_games(store_steamid, element)
    });
} 
