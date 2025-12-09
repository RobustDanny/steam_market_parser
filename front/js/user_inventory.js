const DEFAULT_ICON = "/front/svg/default_item_icon.svg";

document.getElementById("SettingsFormInventory").addEventListener("submit", async (e) => {
e.preventDefault();

const form = e.target;
const data = new URLSearchParams(new FormData(form));

const res = await fetch("/api/get_inventory_items", {
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded"
    },
    body: data
});

const json = await res.json();
console.log("Inventory loaded:", json);

renderUserInventory(json);
});

function renderUserInventory(inventory) {
const container = document.getElementById("user_inventory");

container.innerHTML = ""; // clear old inventory
console.log("kekw");
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

document.addEventListener("click", (e) => {
const card = e.target.closest(".inventory-select");
if (!card) return;

const img = card.dataset.image;

// Find all ad slots
const slots = document.querySelectorAll(".ad_card_image");

// Find first empty slot (default icon)
let emptySlot = Array.from(slots).find(s => 
    s.src.includes("default_item_icon") || s.src === ""
);

// If no empty slot → replace the first one
if (!emptySlot) emptySlot = slots[0];

emptySlot.src = img;

// Also push into hidden form fields if needed
const id = emptySlot.dataset.slot;
if (id) {
    document.getElementById(id).value = img;
}
});

//filter inventory
document.getElementById("inventoryFilter").addEventListener("input", function () {
    const query = this.value.trim().toLowerCase();
    const items = document.querySelectorAll("#user_inventory .card_hover-container");

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

//refresh ad card
document.getElementById("refresh_items").addEventListener("click", function () {
    const DEFAULT_ICON = "/front/svg/default_item_icon.svg";

    // Reset all displayed images
    ["ad_first_item", "ad_second_item", "ad_third_item", "ad_fourth_item"].forEach(slot => {
        const img = document.querySelector(`[data-slot="${slot}"]`);
        if (img) img.src = DEFAULT_ICON;
    });

    // Clear corresponding hidden inputs
    document.querySelectorAll("input[id^='ad_']").forEach(input => {
        input.value = "";
    });
});

//check history ad cards
const historyBtn = document.getElementById("history_cards");
const historyBackdrop = document.getElementById("historyBackdrop");
const historyForm = document.getElementById("history_form");
const mainModal = document.getElementById("formModal");

// OPEN HISTORY
historyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    mainModal.style.display = "none";          // hide main form
    historyBackdrop.style.display = "flex";    // show modal centered
});

// CLOSE WHEN CLICKING OUTSIDE
historyBackdrop.addEventListener("click", (e) => {
    if (!historyForm.contains(e.target)) {
        historyBackdrop.style.display = "none";
        mainModal.style.display = "flex";      // return main modal
    }
});

//get history of ad_cards
document.getElementById("history_cards").addEventListener("click", async (e) => {
    e.preventDefault();

    const steamid = document.getElementById("ad_steamid").value;
    const data = new URLSearchParams({ steamid });

    const res = await fetch("/api/get_ad_cards_history", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: data
    });
    
    const json = await res.json();
    console.log("History_cards:", json);

    renderAdUserHistory(json.ad_card_vec);
});

function renderAdUserHistory(vec) {

    const container = document.getElementById("history_form");
    container.innerHTML = "";

    vec.forEach(item => {
        
        const first  = item.first_item_image  || DEFAULT_ICON;
        const second = item.second_item_image || DEFAULT_ICON;
        const third  = item.third_item_image  || DEFAULT_ICON;
        const fourth = item.fourth_item_image || DEFAULT_ICON;

        const card = `
        <div class="ad_card">
            <div class="ad_image_container">
                <img src="${first}" class="ad_card_image" data-slot="ad_first_item">
                <img src="${second}" class="ad_card_image" data-slot="ad_second_item">
                <img src="${third}" class="ad_card_image" data-slot="ad_third_item">
                <img src="${fourth}" class="ad_card_image" data-slot="ad_fourth_item">
            </div>
        </div>`;
    
        container.insertAdjacentHTML("beforeend", card);
    });
}