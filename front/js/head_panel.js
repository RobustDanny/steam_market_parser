document.getElementById("ad_me").addEventListener("click", async (e) => {

    const store_steamid = document.getElementById("main_steam_id").value;

    get_inventory_games_user(store_steamid)
});

async function get_inventory_games_user(store_steamid){

    const response = await fetch("/api/get_inventory_games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ store_steamid }),
      });
    
      const data = await response.json();

      const select = document.getElementById("settings_appid_select_user");

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