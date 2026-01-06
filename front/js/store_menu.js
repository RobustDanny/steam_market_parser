document.addEventListener("click", (e) => {
    const card = e.target.closest(".ad_card_from_feed");
    if (!card) return;

    document.getElementById("store_menu").style.display = "flex";
    document.getElementById("store_menuBackdrop").style.display = "flex";
});

document.getElementById("enter_store").addEventListener("click", async (e) => {

    const store_steamid = document.getElementById("user_store_steam_id").value;
    const buyer_steamid = document.getElementById("main_steam_id").value;

    if (store_steamid == buyer_steamid){
        
        console.log("Equal");
        return;
    }
    console.log("Store Steamid:", store_steamid);
    console.log("Buyer Steamid:", buyer_steamid);

    // Set the steamid value in the form
    const settingsSteamIdInput = document.querySelector("input[id='store_steamid']");
    if (settingsSteamIdInput) {
        settingsSteamIdInput.value = store_steamid; // Copy the steamid to settings_steamid
    }

    document.getElementById("user_store").style.display = "flex";
    document.getElementById("user_storeBackdrop").style.display = "flex";
    document.getElementById("store_menu").style.display = "none";
    document.getElementById("store_menuBackdrop").style.display = "none";

    add_buyser_to_queue(store_steamid, buyer_steamid)
    get_inventory_games(store_steamid)
    
});

document.getElementById("store_menuBackdrop").addEventListener("click", (e) => {
    if (e.target.id !== "store_menuBackdrop") return;
    e.target.style.display = "none";
});

function add_buyser_to_queue(store_id, buyer_id) {
    fetch("/api/add_to_store_queue", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            buyer_id: buyer_id,
            store_id: store_id,
        }),
    })
    .then(res => res.json())
    .then(json => {
        console.log("Buyer added to queue:", json);
    });
}

async function get_inventory_games(store_steamid){

    const response = await fetch("/api/get_inventory_games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ store_steamid }),
      });
    
      const data = await response.json();

      const select = document.getElementById("settings_appid_select");

    // Clear old options (in case user opens store again)
    select.innerHTML = '<option value="" disabled>Select game</option>';

    data.forEach(game => {
        const option = document.createElement("option");
        option.value = game.appid;
        option.textContent = `${game.name} (${game.items})`;
        select.appendChild(option);
    });

    // Auto-select first game (optional but UX-friendly)
    // if (data.length > 0) {
    //     select.value = data[0].appid;
    // }
}