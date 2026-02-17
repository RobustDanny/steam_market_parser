"use client";

import { useEffect, useMemo, useState } from "react";
import { getInventoryGames, type InventoryGame } from "@/lib/getInventoryGames";
import {
    X,
    Handbag,
    RotateCcw,
    Warehouse
} from "lucide-react";
import { cn } from "@/lib/utils";

type SteamUser = {
    steamid: string;
    nickname: string;
    avatar_url_full: string;
};

type InventoryItem = {
    id: string;              // stable id
    name: string;
    image: string;           // url
};

type GameOpt = { appid: string; name: string };

type SlotKey = "first_item_image" | "second_item_image" | "third_item_image" | "fourth_item_image";
const SLOTS: { key: SlotKey; label: string }[] = [
    { key: "first_item_image", label: "Slot 1" },
    { key: "second_item_image", label: "Slot 2" },
    { key: "third_item_image", label: "Slot 3" },
    { key: "fourth_item_image", label: "Slot 4" },
];

function toUrlEncoded(data: Record<string, string>) {
    const p = new URLSearchParams();
    Object.entries(data).forEach(([k, v]) => p.set(k, v));
    return p.toString();
}

export function AdvertisePopup({
    isOpen,
    onClose,
    steamUser,
    initialSlots,
}: {
    isOpen: boolean;
    onClose: () => void;
    steamUser: SteamUser;
    initialSlots?: Partial<Record<SlotKey, string>>;
}) {
    // Inventory loader form state
    const [appid, setAppid] = useState<string>(""); // selected game
    const [inventoryQuery, setInventoryQuery] = useState("");
    const [loadingInv, setLoadingInv] = useState(false);

    // Inventory content
    const [inventory, setInventory] = useState<InventoryItem[]>([]);

    // Ad “card” slot state (4 images)
    const [slots, setSlots] = useState<Record<SlotKey, string>>({
        first_item_image: initialSlots?.first_item_image ?? "",
        second_item_image: initialSlots?.second_item_image ?? "",
        third_item_image: initialSlots?.third_item_image ?? "",
        fourth_item_image: initialSlots?.fourth_item_image ?? "",
    });

    const [activeSlot, setActiveSlot] = useState<SlotKey>("first_item_image");

    // History modal (you had historyBackdrop/history_form)
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyHtml, setHistoryHtml] = useState<string>("");

    // Close on ESC
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    // Load games once (replace endpoint with yours)
    const [games, setGames] = useState<InventoryGame[]>([]);
    const [gamesLoading, setGamesLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        (async () => {
            setGamesLoading(true);
            try {
                const list = await getInventoryGames(steamUser.steamid);
                setGames(list ?? []);
            } catch (e) {
                console.error(e);
                setGames([]);
            } finally {
                setGamesLoading(false);
            }
        })();
    }, [isOpen, steamUser.steamid]);

    const filteredInventory = useMemo(() => {
        const q = inventoryQuery.trim().toLowerCase();
        if (!q) return inventory;
        return inventory.filter((it) => it.name.toLowerCase().includes(q));
    }, [inventory, inventoryQuery]);

    function pickItemToSlot(item: InventoryItem) {
        setSlots((prev) => ({ ...prev, [activeSlot]: item.image }));
        // auto-advance to next empty slot (nice UX)
        const keys: SlotKey[] = ["first_item_image", "second_item_image", "third_item_image", "fourth_item_image"];
        const nextEmpty = keys.find((k) => (k === activeSlot ? false : !slots[k]));
        if (nextEmpty) setActiveSlot(nextEmpty);
        else {
            const idx = keys.indexOf(activeSlot);
            setActiveSlot(keys[Math.min(idx + 1, keys.length - 1)]);
        }
    }

    async function loadInventory(e?: React.FormEvent) {
        e?.preventDefault();
        if (!appid) return;

        setLoadingInv(true);
        try {
            // TODO: replace with your real inventory endpoint.
            // Your server form was SettingsFormInventory with settings_steamid + settings_appid.
            const body = toUrlEncoded({
                settings_steamid: steamUser.steamid,
                settings_appid: appid,
            });

            const res = await fetch("/api/load_inventory", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            });

            if (!res.ok) {
                setInventory([]);
                return;
            }

            const json = (await res.json()) as { items: InventoryItem[] };
            setInventory(json.items ?? []);
        } finally {
            setLoadingInv(false);
        }
    }

    async function submitAd(e: React.FormEvent) {
        e.preventDefault();

        const body = toUrlEncoded({
            steamid: steamUser.steamid,
            nickname: steamUser.nickname,
            avatar: steamUser.avatar_url_full,
            first_item_image: slots.first_item_image || "",
            second_item_image: slots.second_item_image || "",
            third_item_image: slots.third_item_image || "",
            fourth_item_image: slots.fourth_item_image || "",
        });

        const res = await fetch("/api/add_to_ad_queue", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });

        // same behavior as your server JS: log and close
        let json: any = null;
        try {
            json = await res.json();
        } catch { }
        console.log("Ad added:", json);

        if (res.ok) onClose();
    }

    async function openHistory() {
        setHistoryOpen(true);
        try {
            // TODO: replace with your endpoint that returns html snippet for history_form
            const res = await fetch("/api/ad_history?steamid=" + encodeURIComponent(steamUser.steamid));
            const html = await res.text();
            setHistoryHtml(html);
        } catch {
            setHistoryHtml("<div style='padding:12px;color:#aaa'>No history</div>");
        }
    }

    function resetSlots() {
        setSlots({
            first_item_image: "",
            second_item_image: "",
            third_item_image: "",
            fourth_item_image: "",
        });
        setActiveSlot("first_item_image");
    }

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={(e) => {
                    // click backdrop only
                    if (e.currentTarget === e.target) onClose();
                }}
            />

            {/* Main modal */}
            <div className="fixed z-50 inset-0 flex items-center justify-center p-3">
                <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <div className="font-semibold">Advertise</div>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <div className="flex flex-col lg:flex-row gap-3 justify-between">
                            {/* Inventory loader form */}
                            <form onSubmit={loadInventory} className="w-full lg:w-1/2 rounded-xl border border-border bg-secondary/30 p-3">
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2">
                                        <input type="hidden" name="settings_steamid" value={steamUser.steamid} />

                                        <select
                                            className="h-9 w-full rounded-lg bg-secondary border border-border px-2 text-sm"
                                            value={appid}
                                            onChange={(e) => setAppid(e.target.value)}
                                            disabled={gamesLoading}
                                        >
                                            {gamesLoading ? (
                                                <option>Loading games…</option>
                                            ) : (
                                                <>
                                                    <option value="" disabled>
                                                        Select game
                                                    </option>

                                                    {games.map((g) => (
                                                        <option key={g.appid} value={g.appid}>
                                                            {g.name} ({g.items})
                                                        </option>
                                                    ))}
                                                </>
                                            )}
                                        </select>

                                        <button
                                            type="submit"
                                            className="h-9 w-10 rounded-lg bg-secondary border border-border hover:bg-secondary/70 transition grid place-items-center"
                                            title="Reload inventory"
                                        >
                                            <RotateCcw className="h-4 w-4 opacity-80" />
                                        </button>
                                    </div>


                                    <input
                                        className="h-9 w-full rounded-lg bg-secondary border border-border px-3 text-sm placeholder:text-muted-foreground"
                                        value={inventoryQuery}
                                        onChange={(e) => setInventoryQuery(e.target.value)}
                                        placeholder="Search items..."
                                    />

                                    {/* <div className="text-xs text-muted-foreground">
                                        {loadingInv ? "Loading..." : `Items: ${filteredInventory.length}`}
                                    </div> */}
                                </div>
                            </form>

                            {/* Ad form */}
                            <form onSubmit={submitAd} className="w-full lg:w-1/2 rounded-xl border border-border bg-secondary/30 p-3">
                                {/* hidden fields like server */}
                                <input id="ad_steamid" type="hidden" name="steamid" value={steamUser.steamid} />
                                <input id="ad_nickname" type="hidden" name="nickname" value={steamUser.nickname} />
                                <input id="ad_avatar" type="hidden" name="avatar" value={steamUser.avatar_url_full} />

                                <div className="flex gap-3 justify-center items-center mb-2">
                                    {/* <label className="text-sm text-muted-foreground">Store face</label> */}

                                    <button
                                        type="button"
                                        onClick={resetSlots}
                                        className="h-8 w-8 rounded-md hover:bg-secondary transition grid place-items-center"
                                        title="Reset"
                                    >
                                        <RotateCcw className="h-4 w-4 opacity-80 alt:reload store face" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={openHistory}
                                        className="h-8 w-8 rounded-md hover:bg-secondary transition grid place-items-center"
                                        title="History"
                                    >
                                        <Warehouse className="h-4 w-4 opacity-80 alt:ad storage" />
                                    </button>
                                </div>

                                {/* Ad card (4 slots) */}
                                <div className="w-[180px] mx-auto rounded-lg border border-border bg-card p-1.5">
                                    <div className="grid grid-cols-2 gap-1.5 justify-items-center">
                                        {SLOTS.map((s) => {
                                            const src = slots[s.key];
                                            const isActive = activeSlot === s.key;

                                            return (
                                                <button
                                                    type="button"
                                                    key={s.key}
                                                    onClick={() => setActiveSlot(s.key)}
                                                    className={cn(
                                                        "relative rounded-md overflow-hidden border transition p-0.5 bg-secondary/10",
                                                        isActive
                                                            ? "border-primary ring-1 ring-primary/40"
                                                            : "border-border hover:border-primary/50"
                                                    )}
                                                >
                                                    {src ? (
                                                        <img
                                                            src={src}
                                                            className="h-16 w-16 object-cover rounded"
                                                            alt=""
                                                        />
                                                    ) : (
                                                        <span className="h-16 w-16 flex items-center justify-center rounded bg-secondary/30">
                                                            <Handbag className="h-8 w-8 text-muted-foreground" />
                                                        </span>
                                                    )}
                                                    <input type="hidden" name={s.key} value={slots[s.key] || ""} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-3 flex justify-center">
                                    <button
                                        type="submit"
                                        className="w-[180px] h-9 rounded-lg bg-primary/80 hover:bg-primary/60 text-primary-foreground text-sm font-medium transition"
                                    >
                                        Apply
                                    </button>
                                </div>

                            </form>
                        </div>

                        <div className="h-px bg-border my-4" />

                        {/* Inventory grid */}
                        <div className="rounded-lg border border-border bg-secondary/10 p-2 min-h-[200px]">
                            {filteredInventory.length === 0 ? (
                                <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">
                                    {loadingInv ? "Loading..." : "No items yet"}
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-1.5">
                                    {filteredInventory.map((it) => (
                                        <button
                                            key={it.id}
                                            type="button"
                                            onClick={() => pickItemToSlot(it)}
                                            className="group rounded-md border border-border bg-card overflow-hidden hover:border-primary/60 transition"
                                        >
                                            <img src={it.image} className="w-full aspect-square object-cover" alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>


                    </div>
                </div>
            </div>

            {/* History modal (separate backdrop like your server) */}
            {historyOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[60] bg-black/60"
                        onClick={(e) => {
                            if (e.currentTarget === e.target) setHistoryOpen(false);
                        }}
                    />
                    <div className="fixed inset-0 z-[61] flex items-center justify-center p-3">
                        <div className="w-full max-w-2xl rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                <div className="font-semibold">History</div>
                                <button
                                    onClick={() => setHistoryOpen(false)}
                                    className="h-8 w-8 rounded-md hover:bg-secondary transition grid place-items-center"
                                    aria-label="Close history"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div
                                className="max-h-[70vh] overflow-auto"
                                // server used history_form as raw HTML container
                                dangerouslySetInnerHTML={{ __html: historyHtml }}
                            />
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
