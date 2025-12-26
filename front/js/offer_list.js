document.getElementById("offerList")?.addEventListener("click", () => {
    document.getElementById("offer_listBackdrop").style.display = "flex";
  });
  
document.getElementById("offer_listBackdrop").addEventListener("click", (e) => {
if (e.target.id === "offer_listBackdrop") {
    e.target.style.display = "none";
}
});

document.getElementById("enter_my_store").addEventListener("click", () => {
    // openStoreAndConnect(
    //     document.getElementById("buyer_steam_id").value,
    //     document.getElementById("main_steam_id").value,
    //     "trader"
    // );

    const store_steamid = document.getElementById("main_steam_id").value;

    remove_buyer_from_queue(store_steamid);
});

function remove_buyer_from_queue(store_id){
    fetch("/api/remove_from_store_queue", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            store_id: store_id,
        }),
    })
    .then(res => res.json())
    .then(json => {
        console.log("Buyer is removing from the store queue:", json);
    });
}
