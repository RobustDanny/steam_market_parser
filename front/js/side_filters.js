import { sticky_tooltip } from "./shared_fns.js";

function updateFilters() {
  
    const msg = {
        type: "filters",
        appid: document.getElementById("f_appid").value,
        price_min: document.getElementById("f_min").value,
        price_max: document.getElementById("f_max").value,
        query: document.getElementById("f_query").value,
    }
    ws.send(JSON.stringify(msg));
    
    const url = `/api/filters?appid=${msg.appid}&price_min=${msg.price_min}&price_max=${msg.price_max}&query=${msg.query}`;

    fetch(url)
        .then(res => res.json())
        .then(json => {
            console.log("Filters updated:", json);
        });
}

