document.getElementById("open_setting_form")?.addEventListener("click", () => {
    document.getElementById("settings_form").style.display = "flex";
  });

document.getElementById("settings_form").addEventListener("click", (e) => {
    if (e.target === document.getElementById("settings_form")) {
        document.getElementById("settings_form").style.display = "none"; 
    }
});

document.getElementById("SettingsFormModal").addEventListener("submit", async (e) => {
    e.preventDefault();

    const steam_id = document.getElementById("main_steam_id").value;
    const trade_url = document.getElementById("profile_trade_url").value;

    const res = await fetch("/api/account/post_trade_url", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            steam_id,
            trade_url,
        })
    });

    // const json = await res.json();
    // console.log(json);
});
