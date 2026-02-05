export function sticky_tooltip(element) {
  if (!element) return;

  const tooltip = element.nextElementSibling;
  if (!tooltip) return;

  element.addEventListener("mouseenter", () => {
    tooltip.style.opacity = "1";
    tooltip.style.visibility = "visible";
  });

  element.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0";
    tooltip.style.visibility = "hidden";
  });

  element.addEventListener("mousemove", (e) => {
    tooltip.style.left = e.clientX + 12 + "px";
    tooltip.style.top = e.clientY + 12 + "px";
  });
}

export function loader(element){
  element.innerHTML = "";

  element.insertAdjacentHTML("beforeend", `
    <div class="loader-container">
      <div class="loader"></div>
    </div>
  `);
}

export function ChangeStyleOfElements(elArray, property, value) {
  console.log("hey");
  elArray.forEach(el => {
    if (!el) return;

    // If it's a NodeList or HTMLCollection
    if (el instanceof NodeList || el instanceof HTMLCollection) {
      el.forEach(child => {
        if (child?.style) {
          child.style[property] = value;
        }
      });
    }
    // Single element
    else if (el.style) {
      el.style[property] = value;
    }
  });
}


export function horizontallScroll(el) {
  if (!el) return;
  if (el.dataset.middleScrollAttached) return;
  el.dataset.middleScrollAttached = "1";

  let active = false;
  let startX = 0;
  let startScrollLeft = 0;

  el.addEventListener("mousedown", (e) => {
    if (e.button !== 1) return; // middle mouse only
    e.preventDefault();

    active = true;
    startX = e.clientX;
    startScrollLeft = el.scrollLeft;

    document.body.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!active) return;
    const dx = e.clientX - startX;
    el.scrollLeft = startScrollLeft - dx;
  });

  document.addEventListener("mouseup", () => {
    if (!active) return;
    active = false;
    document.body.style.cursor = "";
  });
}

export async function get_inventory_games(store_steamid, element) {
    if (!element) return;
    const response = await fetch("/api/get_inventory_games", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ store_steamid }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Backend error:", text);
      return;
    }

    const data = await response.json();
  
    // Clear old options
    element.innerHTML = '<option value="" disabled>Select game</option>';
  
    (data || []).forEach(game => {
      const option = document.createElement("option");
      option.value = game.appid;
      option.textContent = `${game.name} (${game.items})`;
      element.appendChild(option);
    });
  }