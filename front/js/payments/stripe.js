export async function startStripePay(offer_id) {
    console.log("Stripe clicked");
    if (!offer_id) return console.error("No offer_id");

    const btn = document.getElementById("pay_stripe_btn");
    if (btn) btn.style.pointerEvents = "none";

    try {
        const res = await fetch("/api/payment/stripe/create_checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offer_id }),
        });

        console.log("create_checkout status", res.status);

        if (!res.ok) {
            console.error("create_checkout failed:", await res.text());
            return;
        }

        const data = await res.json();
        console.log("create_checkout json", data);

        if (!data.checkout_url) return console.error("No checkout_url");
        window.location.href = data.checkout_url;
    } finally {
        if (btn) btn.style.pointerEvents = "";
    }
}