document.addEventListener("click", (e) => {
    const card = e.target.closest(".ad_card_from_feed");
    if (!card) return;

    document.getElementById("store_menu").style.display = "flex";
    document.getElementById("store_menuBackdrop").style.display = "flex";
});

document.getElementById("enter_store").addEventListener("click", (e) => {

    const steamid = document.getElementById("user_store_steam_id").value;
    // console.log("steamid!:", steamid);

    // Set the steamid value in the form
    const settingsSteamIdInput = document.querySelector("input[id='store_steamid']");
    if (settingsSteamIdInput) {
        settingsSteamIdInput.value = steamid; // Copy the steamid to settings_steamid
    }

    document.getElementById("user_store").style.display = "flex";
    document.getElementById("user_storeBackdrop").style.display = "flex";
    document.getElementById("store_menu").style.display = "none";
    document.getElementById("store_menuBackdrop").style.display = "none";
});


document.getElementById("store_menuBackdrop").addEventListener("click", (e) => {
    if (e.target.id !== "store_menuBackdrop") return;
    e.target.style.display = "none";
});