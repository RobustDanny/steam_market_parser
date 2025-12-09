document.getElementById("adMeBtn")?.addEventListener("click", () => {
    document.getElementById("formModal").style.display = "flex";
  });
  
  document.getElementById("formModal").addEventListener("click", (e) => {
    if (e.target.id === "formModal") {
      e.target.style.display = "none";
    }
  });

  document.getElementById("adFormModal").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const data = new URLSearchParams(new FormData(form));

    const res = await fetch("/api/add_to_ad_queue", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: data
    });

    const json = await res.json();
    console.log("Ad added:", json);

    document.getElementById("formModal").style.display = "none";
});

document.addEventListener("click", (e) => {
  if (e.target.closest("#ad_card_from_feed")) {
 
    const steamid = document.getElementById("ad_card_from_feed_input").value;
    
  }
});