export function sticky_tooltip(element, opts = {}) {
  if (!element) return;

  const tooltip = element.nextElementSibling;
  if (!tooltip) return;

  const {
    offset = 12,
    margin = 8,
    container = null,
    preferSide = "auto",
    preferVertical = "auto",
  } = opts;

  if (!tooltip.dataset.moved) {
    document.body.appendChild(tooltip);
    tooltip.dataset.moved = "1";
  }

  tooltip.style.position = "fixed";
  tooltip.style.pointerEvents = "none";
  tooltip.style.willChange = "left, top";

  let raf = 0;
  let lastEvent = null;
  let isOpen = false;

  function getBounds() {
    if (container && container.getBoundingClientRect) {
      const r = container.getBoundingClientRect();
      return {
        left: r.left + margin,
        top: r.top + margin,
        right: r.right - margin,
        bottom: r.bottom - margin,
      };
    }
    return {
      left: margin,
      top: margin,
      right: window.innerWidth - margin,
      bottom: window.innerHeight - margin,
    };
  }

  function place(e) {
    if (!isOpen) return; // <-- key gate

    const b = getBounds();

    // Must be measurable; don't use display:none in CSS
    const tip = tooltip.getBoundingClientRect();

    const wantRight =
      preferSide === "right" ? true :
      preferSide === "left"  ? false :
      true;

    const wantDown =
      preferVertical === "down" ? true :
      preferVertical === "up"   ? false :
      true;

    const rightX = e.clientX + offset;
    const leftX  = e.clientX - offset - tip.width;
    const downY  = e.clientY + offset;
    const upY    = e.clientY - offset - tip.height;

    let x = wantRight ? rightX : leftX;
    if (x + tip.width > b.right) x = leftX;
    if (x < b.left) x = rightX;

    let y = wantDown ? downY : upY;
    if (y + tip.height > b.bottom) y = upY;
    if (y < b.top) y = downY;

    x = Math.min(Math.max(x, b.left), b.right - tip.width);
    y = Math.min(Math.max(y, b.top), b.bottom - tip.height);

    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top  = `${Math.round(y)}px`;
  }

  function onMove(e) {
    if (!isOpen) return;
    lastEvent = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (lastEvent) place(lastEvent);
    });
  }

  function show(e) {
    isOpen = true;
    tooltip.style.opacity = "1";
    tooltip.style.visibility = "visible";
    lastEvent = e;
    place(e);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);
  }

  function hide() {
    isOpen = false;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    tooltip.style.opacity = "0";
    tooltip.style.visibility = "hidden";

    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
  }

  function onScrollOrResize() {
    if (!isOpen || !lastEvent) return;
    place(lastEvent);
  }

  element.addEventListener("mouseenter", show);
  element.addEventListener("mouseleave", hide);
  element.addEventListener("mousemove", onMove);

  // optional focus tooltips
  element.addEventListener("focus", () => {
    const r = element.getBoundingClientRect();
    show({ clientX: r.left + r.width / 2, clientY: r.top });
  });
  element.addEventListener("blur", hide);
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