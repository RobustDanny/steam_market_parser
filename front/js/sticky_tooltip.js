// const arrow_up = document.getElementById("arrow_up");
//   const pause = document.getElementById("pause_icon");
//   const arrow_down = document.getElementById("arrow_down");

//   document.addEventListener("DOMContentLoaded", () => {
//   sticky_tooltip(arrow_up);
//   sticky_tooltip(pause);
//   sticky_tooltip(arrow_down);
// });

export function sticky_tooltip(element){
    const tooltip = element.nextElementSibling;
    
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

export async function get_inventory_games(store_steamid, element) {
    if (!element) return;
    const response = await fetch("/api/get_inventory_games", {
      method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      body: JSON.stringify({ store_steamid }),
    });
  
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