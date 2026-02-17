export type InventoryGame = { appid: string; name: string; items: number };

export async function getInventoryGames(store_steamid: string): Promise<InventoryGame[]> {
    const res = await fetch("/api/get_inventory_games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_steamid }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "get_inventory_games failed");
    }

    // server returns array
    return (await res.json()) as InventoryGame[];
}
