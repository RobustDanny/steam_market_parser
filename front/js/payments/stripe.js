export async function startStripePay(offer_id) {
    if (!offer_id) return console.error("No offer_id");

    const newTab = window.open("", "_blank");

    try {
        const res = await fetch("/api/payment/stripe/create_checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offer_id }),
        });

        if (!res.ok) {
            newTab.close();
            console.error(await res.text());
            return;
        }

        const data = await res.json();

        if (!data.checkout_url) {
            newTab.close();
            return;
        }

        newTab.location.href = data.checkout_url;

    } catch (err) {
        newTab.close();
        console.error(err);
    }
}
