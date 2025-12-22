document.getElementById("offerList")?.addEventListener("click", () => {
    document.getElementById("offer_listBackdrop").style.display = "flex";
  });
  
document.getElementById("offer_listBackdrop").addEventListener("click", (e) => {
if (e.target.id === "offer_listBackdrop") {
    e.target.style.display = "none";
}
});

document.getElementById("enter_my_store").addEventListener("click", () => {
    openStoreAndConnect(
        document.getElementById("buyer_steam_id").value,
        document.getElementById("main_steam_id").value,
        "trader"
    );
});
