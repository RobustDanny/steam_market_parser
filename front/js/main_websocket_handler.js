const main_ws = new WebSocket("ws://127.0.0.1:8080/ws");
const ad_main_ws = new WebSocket("ws://127.0.0.1:8080/ws/ads");

let CardAdAppearing = "stores_items";

export function sendMainWS(payload) {
  if (!main_ws || main_ws.readyState !== WebSocket.OPEN) {
    console.warn("WS not connected (send skipped)");
    return;
  }
  main_ws.send(JSON.stringify(payload));
}

export function sendAdWS(payload) {
  if (!ad_main_ws || ad_main_ws.readyState !== WebSocket.OPEN) {
    console.warn("WS not connected (send skipped)");
    return;
  }
  ad_main_ws.send(JSON.stringify(payload));
}

// =======================
// Pagination state
// =======================

const PAGE_SIZE = 200;
let cards = [];              // newest first (index 0 is newest)
let currentPage = 0;         // 0 = newest page
let isPaused = false;

const container = document.getElementById("items-container");

// Optional: buffer incoming cards while paused (so you don't lose them)
let pausedBuffer = [];

// -----------------------
// Helpers
// -----------------------

const pageIndicator = document.getElementById("page_indicator");

function updatePageIndicator() {
  if (!pageIndicator) return;

  const total = totalPages();
  const current = total === 0 ? 0 : currentPage + 1;

  pageIndicator.textContent = `${current} / ${total}`;
}

function totalPages() {
  return Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
}

function clampPage() {
  const tp = totalPages();
  if (currentPage < 0) currentPage = 0;
  if (currentPage > tp - 1) currentPage = tp - 1;
}

function renderPage() {
  clampPage();

  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  container.innerHTML = cards.slice(start, end).join("");

  updatePageIndicator();
}

function addCard(html) {
  // store newest first
  cards.unshift(html);

  // If currently bromain_wsing older pages, keep the "same items" visible:
  // when a new card arrives at the front, shift the view by 1 (only if not on newest page)
  if (currentPage > 0) currentPage += 1;

  renderPage();
}

// =======================
// Media buttons (pagination controls)
// =======================

const btnUp = document.getElementById("arrow_up");     // "Next event" (newer)
const btnDown = document.getElementById("arrow_down"); // "Previous event" (older)
const btnPause = document.getElementById("pause_icon");

if (btnUp) {
  btnUp.addEventListener("click", () => {
    // go toward newer pages (lower page index)
    currentPage -= 1;
    renderPage();
  });
}

if (btnDown) {
  btnDown.addEventListener("click", () => {
    // go toward older pages (higher page index)
    currentPage += 1;
    renderPage();
  });
}

if (btnPause) {
  btnPause.addEventListener("click", () => {
    isPaused = !isPaused;

    btnPause.src = isPaused ? "/front/svg/play_icon.svg" : "/front/svg/pause_icon.svg";
    // If unpausing, flush buffered cards in correct order (newest first)
    if (!isPaused && pausedBuffer.length) {
      // pausedBuffer was collected newest-first via unshift below,
      // so we can prepend them back to cards in order:
      cards = pausedBuffer.concat(cards);
      pausedBuffer = [];
      renderPage();
    }

    // Optional UI feedback via CSS class
    btnPause.classList.toggle("is_paused", isPaused);
  });
}

// =======================
// ad_main_ws (ads feed)
// =======================

ad_main_ws.onopen = () => console.log("ad_main_ws CONNECTED");
ad_main_ws.onclose = () => console.log("ad_main_ws CLOSED");
ad_main_ws.onerror = (err) => console.log("ad_main_ws ERROR", err);

ad_main_ws.onmessage = (event) => {
  if(CardAdAppearing == "stores" || CardAdAppearing == "stores_items"){
    const data = JSON.parse(event.data);

    if (!data.user_ads || !data.user_ads[0]) {
      console.error("No ads received or ads data is invalid");
      return;
    }

    // Get only the FIRST ad
    const user_ad = data.user_ads[0];

    const img1 = user_ad.first_item_image  || "/front/svg/default_item_icon.svg";
    const img2 = user_ad.second_item_image || "/front/svg/default_item_icon.svg";
    const img3 = user_ad.third_item_image  || "/front/svg/default_item_icon.svg";
    const img4 = user_ad.fourth_item_image || "/front/svg/default_item_icon.svg";

    const adHtml = `
      <div class="ad_card_from_feed" data-steamid="${user_ad.steamid}">
        <div class="card_hover-container">
          <div class="ad_card">
            <div class="ad_image_container">
              <img src="${img1}" class="ad_card_image">
              <img src="${img2}" class="ad_card_image">
              <img src="${img3}" class="ad_card_image">
              <img src="${img4}" class="ad_card_image">
            </div>
          </div>
        </div>
      </div>
    `;

    if (isPaused) {
      pausedBuffer.unshift(adHtml);
      return;
    }
    addCard(adHtml);
  }
};

// =======================
// main_ws (items feed)
// =======================

main_ws.onopen = () => console.log("main_ws CONNECTED");
main_ws.onclose = () => console.log("main_ws CLOSED");
main_ws.onerror = (err) => console.log("main_ws ERROR", err);

main_ws.onmessage = (event) => {
  const payload = JSON.parse(event.data);

  // console.log("Received update:", payload);
  if (payload.type === "filters") {
    if (payload.card_appearing) {
      CardAdAppearing = payload.card_appearing;
    }
  }

  const arr = payload.items || [];
  if (!arr.length) return;

  // Build cards first (so we preserve order consistently)
  const newCards = arr.map((item) => {
    return `
      <div class="card_hover-container">
        <div class="card">
          <div class="card-details">
            <img class="game_icon" src="${item.game_icon}">
            <div>

              <div class="card_tooltip-container">
                <img class="more_icon" src="/front/svg/more_icon.svg">
                <span class="tooltip_actions">
                  <a href="https://steamcommunity.com/market/listings/${item.appid}/${item.market_hash_name}"
                     target="_blank" rel="noopener noreferrer">
                    <img class="tooltip_icon" src="/front/svg/grab_icon.svg">
                  </a>
                  <img class="tooltip_icon" src="/front/svg/info_icon.svg">
                </span>
              </div>

              <div style="overflow: hidden;">
                <img src="https://steamcommunity.com/economy/image/${item.icon}"
                     alt="${item.name}" class="item_icon">
              </div>

            </div>
            <span class="hidden-text">${item.name}</span>
            <span class="text-price">$${item.converted_price}</span>
          </div>
        </div>
      </div>
    `;
  });

  if (isPaused) {
    // newest first, so put newest at the beginning
    for (let i = newCards.length - 1; i >= 0; i--) {
      pausedBuffer.unshift(newCards[i]);
    }
    return;
  }

  // Add each as newest-first
  for (let i = newCards.length - 1; i >= 0; i--) {
    addCard(newCards[i]);
  }
};

// Initial render (empty)
renderPage();
