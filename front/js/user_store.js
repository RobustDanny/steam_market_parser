let storeChatWS = null;

document.getElementById("user_storeBackdrop").addEventListener("click", (e) => {
    if (e.target.id !== "user_storeBackdrop") return;
    e.target.style.display = "none";
});

//load store items
document.getElementById("store_filters_form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const form = e.target;

    if (document.getElementById("user_store_steam_id").value == null){
        steamid = document.getElementById("main_steam_id").value;
    }
    else{
        steamid = document.getElementById("user_store_steam_id").value;
    }

    const steamIdInput = document.getElementById("store_steamid");
    steamIdInput.value = steamid;

    console.log("form", form);

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

document.getElementById("enter_store").addEventListener("click", () => {
    const buyerId = document.getElementById("main_steam_id").value;
    const traderId = document.getElementById("user_store_steam_id").value;

    connectStoreChatWS(buyerId, traderId);
});

document.getElementById("chat_send").addEventListener("click", sendChatMessage);

document.getElementById("chat_input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        sendChatMessage();
    }
});

function sendChatMessage() {
    if (!storeChatWS || storeChatWS.readyState !== WebSocket.OPEN) {
        console.warn("WS not connected");
        return;
    }

    const input = document.getElementById("chat_input");
    const text = input.value.trim();

    if (!text) return;

    const message = {
        type: "chat",
        text: text
    };

    storeChatWS.send(JSON.stringify(message));

    // Optimistic UI (show immediately)
    appendChatMessage("me", text);

    input.value = "";
}

function appendChatMessage(from, text) {
    const container = document.getElementById("chat_messages");

    const messageEl = document.createElement("div");
    messageEl.className = from === "me"
        ? "chat_message chat_message_me"
        : "chat_message chat_message_other";

    messageEl.textContent = text;

    container.appendChild(messageEl);

    // Auto scroll
    container.scrollTop = container.scrollHeight;
}

function connectStoreChatWS(buyerId, traderId) {
    if (storeChatWS?.readyState === WebSocket.OPEN) {
        console.warn("WS already connected");
        return;
    }

    const wsUrl = `ws://127.0.0.1:8080/ws/chat?buyer=${buyerId}&trader=${traderId}`;

    storeChatWS = new WebSocket(wsUrl);

    storeChatWS.onopen = () => {
        console.log("STORE CHAT WS CONNECTED");
    };

    storeChatWS.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        appendChatMessage(msg.from, msg.text);
    };

    storeChatWS.onclose = () => {
        console.log("STORE CHAT WS CLOSED");
        storeChatWS = null;
    };

    storeChatWS.onerror = (e) => {
        console.error("STORE CHAT WS ERROR", e);
    };
}
