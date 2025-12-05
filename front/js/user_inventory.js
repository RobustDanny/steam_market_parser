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