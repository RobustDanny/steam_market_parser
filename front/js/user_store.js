document.getElementById("user_storeBackdrop").addEventListener("click", (e) => {
    if (e.target.id !== "user_storeBackdrop") return;
    e.target.style.display = "none";
});

//load store items
document.getElementById("store_filters_form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const form = e.target;

    // const store_steamid = document.getElementById("store_steamid").value;
    // console.log("store_steamid!:", store_steamid);

    // Just ensure the steamid is in the form before submission
    const steamid = document.getElementById("user_store_steam_id").value;
    const settingsSteamIdInput = document.querySelector("input[name='settings_steamid']");
    if (settingsSteamIdInput) {
        settingsSteamIdInput.value = steamid; // Ensure steamid is in the form
    }

    const data = new URLSearchParams(new FormData(form));

    console.log("data", form);
    
    const res = await fetch("/api/get_inventory_items", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: data
    });
    
    const json = await res.json();
    console.log("Store inventory loaded:", json);
    
    renderStoreInventory(json);
    });
    
    function renderStoreInventory(inventory) {
    const container = document.getElementById("store_inventory");
    
    container.innerHTML = ""; // clear old inventory
    
    const assets = inventory.assets || [];
    const descriptions = inventory.descriptions || [];
    
    // Quick lookup by classid+instanceid
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
    
        const card = `
            <div class="card_hover-container inventory-select" data-image="${icon}">
                <div class="inventory_card">
                    <div class="inventory_card_details">
                        <div>
                            <img class="inventory_item_icon" src="${icon}" alt="${name}">
                        </div>
                        <span class="hidden-text">${name}</span>
                    </div>
                </div>
            </div>
        `;
    
        container.insertAdjacentHTML("beforeend", card);
    });
}

//filter inventory
document.getElementById("store_inventoryFilter").addEventListener("input", function () {
    const query = this.value.trim().toLowerCase();
    const items = document.querySelectorAll("#store_inventory .card_hover-container");

    items.forEach(item => {
        const nameEl = item.querySelector(".hidden-text");
        const name = nameEl ? nameEl.textContent.toLowerCase() : "";

        if (name.includes(query)) {
            item.style.display = "";
        } else {
            item.style.display = "none";
        }
    });
});

document.getElementById("enter_store").addEventListener("click", (e) => {
    // Extract buyer and trader Steam IDs from data attributes
    const buyerSteamId = document.getElementById("main_steam_id").value;
    const traderSteamId = document.getElementById("user_store_steam_id").value;

    if (buyerSteamId && traderSteamId) {
        // Create the WebSocket URL with buyer and trader Steam IDs as query parameters
        const wsUrl = `ws://127.0.0.1:8080/ws/chat?buyer=${buyerSteamId}&trader=${traderSteamId}`;

        // Open the WebSocket connection
        const ws_chat = new WebSocket(wsUrl);

        // Handle WebSocket events (open, message, close, etc.)
        ws_chat.onopen = () => {
            console.log("ws_chat connected");
        };

        ws_chat.onmessage = (event) => {
            console.log("Message received from ws_chat:", event.data);
        };

        ws_chat.onclose = () => {
            console.log("ws_chat closed");
        };

        ws_chat.onerror = (error) => {
            console.error("ws_chat error:", error);
        };
    } else {
        console.error("Buyer or trader Steam ID is missing.");
    }
});
