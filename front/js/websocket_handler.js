window.ws = new WebSocket("ws://127.0.0.1:8080/ws");
window.ws_ad = new WebSocket("ws://127.0.0.1:8080/ws/ads");

ws_ad.onopen = () => console.log("WS_AD CONNECTED");
ws_ad.onclose = () => console.log("WS_AD CLOSED");
ws_ad.onerror = (err) => console.log("WS_AD ERROR", err);

ws_ad.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (!data.user_ads || !data.user_ads[0]) {
      console.error("No ads received or ads data is invalid");
      return;
  }

    // Get only the FIRST ad
    const user_ad = data.user_ads?.[0];
    // if (!user_ad) return;
    
    const container = document.getElementById("items-container");

    const img1 = user_ad.first_item_image  || "/front/svg/default_item_icon.svg";
    const img2 = user_ad.second_item_image || "/front/svg/default_item_icon.svg";
    const img3 = user_ad.third_item_image  || "/front/svg/default_item_icon.svg";
    const img4 = user_ad.fourth_item_image || "/front/svg/default_item_icon.svg";

    container.insertAdjacentHTML("afterbegin", `
      <div class="ad_card_from_feed" id="ad_card_for_inventory_load">
        <input name="user_store_steam_id" id="user_store_steam_id" style="display: none;" type="hidden" value="${user_ad.steamid}">
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
    `);
};

ws.onopen = () => console.log("WS CONNECTED");
ws.onclose = () => console.log("WS CLOSED");
ws.onerror = (err) => console.log("WS ERROR", err);

ws.onmessage = (event) => {
  const items = JSON.parse(event.data);

    console.log("Received update:", items);

    const container = document.getElementById("items-container");

    items.items.forEach(item => {

      const card = `
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
              <img src="https://steamcommunity.com/economy/image/${ item.icon }" alt="${ item.name }" class="item_icon">
              </div>
              </div>
              <span class="hidden-text">${item.name}</span>
              <span class="text-price">$${item.converted_price}</span>
              </div>
          </div>
        </div>
      `;
        
      container.insertAdjacentHTML("afterbegin", card);        

    });
};