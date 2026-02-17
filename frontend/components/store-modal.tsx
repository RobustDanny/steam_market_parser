"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    RotateCcw,
    ChevronDown,
    Send,
    PersonStanding,
    Bot,
    User,
    Store,
    DollarSign,
    Plus,
    Minus,
    Repeat,
    Send as SendIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useStoreChat } from "@/hooks/useStoreChat";
import { getInventoryGames, type InventoryGame } from "@/lib/getInventoryGames";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type InventoryItem = {
    id: string;           // assetid (unique per item)
    assetid: string;
    contextid: string;    // important for trading
    appid: string;
    name: string;
    image: string;
    classid: string;
    instanceid: string;
};

type SelectedItem = {
    key: string; // assetid
    contextid: string;
    appid: string;
    name: string;
    image: string;
    link: string;
    price: string; // string input
};

interface StoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeName?: string;

    buyerId: string;
    traderId: string; // store steamid
    role: "buyer" | "trader";
    initialGames?: InventoryGame[];
}

interface ChatMessage {
    id: number;
    type: "buyer" | "trader" | "system" | "offer";
    sender: string;
    text?: string;
    time: string;
    offerPrice?: number;
    offerItemCount?: number;
    offerStatus?: string;
    offerAdded?: string[];
    offerRemoved?: string[];
    offerChanged?: string[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
    {
        id: 1,
        type: "system",
        sender: "System",
        text: "Trade room opened. Waiting for both participants.",
        time: "10:01",
    },
    { id: 2, type: "system", sender: "System", text: "TRADER CONNECTED", time: "10:01" },
    { id: 3, type: "trader", sender: "Trader", text: "Hey, welcome! What items are you looking for?", time: "10:02" },
    { id: 4, type: "buyer", sender: "You", text: "Hi! I'm interested in the Elden Ring cards.", time: "10:02" },
    {
        id: 5,
        type: "offer",
        sender: "System",
        time: "10:03",
        offerStatus: "OFFER SENT",
        offerPrice: 12,
        offerItemCount: 3,
        offerAdded: ["Elden Ring Card ($4.00)", "Elden Ring Card ($4.00)", "Elden Ring Card ($4.00)"],
        offerRemoved: [],
        offerChanged: [],
    },
    { id: 6, type: "trader", sender: "Trader", text: "Let me know if that works for you.", time: "10:03" },
    {
        id: 7,
        type: "offer",
        sender: "System",
        time: "10:04",
        offerStatus: "OFFER UPDATED",
        offerPrice: 10,
        offerItemCount: 3,
        offerAdded: [],
        offerRemoved: ["Elden Ring Card ($4.00)"],
        offerChanged: ["Price: $12.00 -> $10.00"],
    },
    { id: 8, type: "system", sender: "System", text: "Reminder: verify items before paying.", time: "10:04" },
    {
        id: 9,
        type: "offer",
        sender: "System",
        time: "10:05",
        offerStatus: "TRADER'S ACCEPTED OFFER",
        offerPrice: 10,
        offerItemCount: 2,
        offerAdded: ["Qbik Booster Pack ($5.00)"],
        offerRemoved: ["Elden Ring Card ($4.00)"],
        offerChanged: ["Total items: 3 -> 2"],
    },
];

const MSG_STYLES: Record<string, { bg: string; accent: string; icon: React.ElementType }> = {
    buyer: { bg: "bg-primary/8", accent: "text-primary", icon: User },
    trader: { bg: "bg-accent/8", accent: "text-accent", icon: Store },
    system: { bg: "bg-muted/50", accent: "text-muted-foreground", icon: Bot },
    offer: { bg: "bg-chart-3/8", accent: "text-chart-3", icon: DollarSign },
};

type SteamInventoryResponse = {
    assets?: {
        assetid: string;
        classid: string;
        instanceid: string;
        amount?: string;
        contextid?: string; // optional (some backends add it)
        appid?: string;     // optional
    }[];
    descriptions?: {
        classid: string;
        instanceid: string;
        icon_url?: string;
        name?: string;
    }[];
};


function mapSteamInventoryToItems(inv: SteamInventoryResponse, fallbackAppid: string): InventoryItem[] {
    const assets = inv.assets ?? [];
    const descriptions = inv.descriptions ?? [];

    const descMap = new Map<string, (typeof descriptions)[number]>();
    for (const d of descriptions) {
        descMap.set(`${d.classid}_${d.instanceid}`, d);
    }

    const out: InventoryItem[] = [];

    for (const a of assets) {
        const d = descMap.get(`${a.classid}_${a.instanceid}`);
        if (!d) continue;

        const image = d.icon_url ? `https://steamcommunity.com/economy/image/${d.icon_url}` : "";

        // ✅ If your backend doesn't return contextid, you MUST provide it somehow.
        // Most common Steam inventory context for items is "2" (but not always).
        const contextid = a.contextid ?? "2";

        out.push({
            id: a.assetid,           // ✅ unique per item
            assetid: a.assetid,
            contextid,
            appid: a.appid ?? fallbackAppid,
            classid: a.classid,
            instanceid: a.instanceid,
            name: d.name ?? "Unknown item",
            image,
        });
    }

    return out;
}


export function StoreModal({
    isOpen,
    onClose,
    storeName = "Project Winter",
    buyerId,
    traderId,
    role,
    initialGames = [],
}: StoreModalProps) {
    const [message, setMessage] = useState("");
    const [searchItems, setSearchItems] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [showPay, setShowPay] = useState(false);

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loadingInv, setLoadingInv] = useState(false);

    // games select (like AdvertisePopup)
    const [appid, setAppid] = useState<string>("");
    const [games, setGames] = useState<InventoryGame[]>(initialGames);
    const [gamesLoading, setGamesLoading] = useState(false);

    const filteredInventory = useMemo(() => {
        const q = searchItems.trim().toLowerCase();
        if (!q) return inventory;
        return inventory.filter((it) => it.name.toLowerCase().includes(q));
    }, [inventory, searchItems]);


    useEffect(() => {
        setGames(initialGames ?? []);
        setAppid("");
    }, [initialGames, traderId]);

    async function loadInventory() {
        if (!appid) return;
        if (!traderId) return;

        setLoadingInv(true);

        try {
            const body = new URLSearchParams({
                settings_steamid: traderId,
                settings_appid: appid,
            }).toString();

            const res = await fetch("/api/get_inventory_items", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            });

            if (!res.ok) {
                console.error("get_inventory_items failed:", await res.text());
                setInventory([]);
                return;
            }

            const json = (await res.json()) as SteamInventoryResponse;
            const items = mapSteamInventoryToItems(json, appid);
            setInventory(items);
        } catch (err) {
            console.error(err);
            setInventory([]);
        } finally {
            setLoadingInv(false);
        }
    }


    const { sendWS, offerId, ensureOfferId, bothInRoom, canPay, canAccept, statusText } = useStoreChat({
        buyerId,
        traderId,
        role,
    });

    const addToOffer = (item: Omit<SelectedItem, "price">) => {
        setSelectedItems((prev) => {
            if (prev.some((x) => x.key === item.key)) return prev;
            return [...prev, { ...item, price: "" }];
        });
    };

    const removeFromOffer = (key: string) => {
        setSelectedItems((prev) => prev.filter((x) => x.key !== key));
    };

    const setItemPrice = (key: string, price: string) => {
        if (!/^\d*\.?\d*$/.test(price)) return;
        setSelectedItems((prev) => prev.map((x) => (x.key === key ? { ...x, price } : x)));
    };

    const sendItems = async () => {
        if (selectedItems.length === 0) return;

        const offer_id = await ensureOfferId();

        const special_for_update_offer = selectedItems.map((it) => ({
            item_asset_id: it.key,
            item_contextid: it.contextid,
            item_appid: it.appid,
            item_name: it.name,
            item_price: (it.price || "0").toString(),
            item_link: it.link,
            item_image: it.image,
        }));

        const res = await fetch("/api/offer/update_offer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offer_id, special_for_update_offer }),
        });

        if (!res.ok) {
            console.error("update_offer failed", await res.text());
            return;
        }

        const json = await res.json();

        const wsItems = selectedItems.map((it) => ({
            key: it.key,
            contextid: it.contextid,
            appid: it.appid,
            image: it.image,
            price: Number(it.price) || 0,
            name: it.name,
            link: it.link,
        }));

        sendWS({ type: "offer_items", items: wsItems });
        sendWS({ type: "offer_log", json });
        sendWS({ type: "send_offer" });
    };

    const acceptOffer = async () => {
        if (!offerId) return;

        await fetch("/api/offer/update_status_offer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offer_id: offerId, status: "ACCEPTED" }),
        });

        sendWS({ type: "accept_offer", text: "Trader accept offer" });
        sendWS({ type: "system", text: "Trader's accepted offer" });
        sendWS({ type: "offer_step_accepting" });
    };

    const goToPayStep = async () => {
        sendWS({ type: "offer_step_paying" });
        setShowPay(true);
    };

    const sendMessage = () => {
        if (!message.trim()) return;
        setMessages((prev) => [
            ...prev,
            {
                id: prev.length + 1,
                type: "buyer",
                sender: "You",
                text: message,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
        ]);
        setMessage("");
    };

    useEffect(() => {
        if (!appid) return;
        loadInventory();
    }, [appid]);


    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                onClick={(e) => {
                    if (e.currentTarget === e.target) onClose();
                }}
            />

            {/* Modal */}
            <div className="fixed inset-4 md:inset-8 lg:inset-12 z-50 rounded-2xl bg-card border border-border shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
                {/* Top bar */}
                <div className="flex items-stretch border-b border-border min-h-[72px]">
                    {/* Left: back + store info */}
                    <div className="flex items-center gap-3 px-4 flex-1 border-r border-border">
                        <button
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="flex items-center gap-2">
                            <select
                                className="h-9 w-full rounded-lg bg-secondary border border-border px-2 text-sm"
                                value={appid}
                                onChange={(e) => setAppid(e.target.value)}
                                disabled={gamesLoading || games.length === 0}
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
                                type="button"
                                onClick={loadInventory}
                                className="h-9 w-10 rounded-lg bg-secondary border border-border hover:bg-secondary/70 transition grid place-items-center"
                                title="Reload games"
                                aria-label="Reload games"
                            >
                                <RotateCcw className="h-4 w-4 opacity-80" />
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                            <PersonStanding className="h-4 w-4" />
                            <span className="text-sm">Queue</span>
                        </div>
                    </div>

                    {/* Center: status + actions */}
                    <div className="flex flex-col items-center justify-center gap-2 px-6 flex-1 border-r border-border">
                        <p className="text-sm text-muted-foreground">{statusText}</p>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                className="rounded-lg px-8 h-9"
                                onClick={sendItems}
                                disabled={!bothInRoom || selectedItems.length === 0}
                            >
                                Send
                            </Button>

                            {role === "buyer" ? (
                                <Button variant="secondary" className="rounded-lg px-8 h-9" onClick={goToPayStep} disabled={!canPay}>
                                    Pay
                                </Button>
                            ) : (
                                <Button
                                    variant="secondary"
                                    className="rounded-lg px-8 h-9"
                                    onClick={acceptOffer}
                                    disabled={!canAccept}
                                >
                                    Accept
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex flex-1 min-h-0">
                    {/* Left: offer area + items */}
                    <div className="flex-1 flex flex-col border-r border-border">
                        {/* Offer zone */}
                        <div className="flex-1 border-b border-border p-4">
                            <div className="h-full rounded-lg bg-secondary/30 border border-border" />
                        </div>

                        {/* Items section */}
                        <div className="flex-1 p-4 flex flex-col">
                            <div className="rounded-lg bg-secondary/30 border border-border flex-1 flex flex-col p-4">
                                {/* ✅ Games dropdown + reload + search (like AdvertisePopup) */}
                                <div className="flex items-center gap-2 mb-3">
                                    <Input
                                        className="h-9 w-full rounded-lg bg-secondary border border-border px-3 text-sm placeholder:text-muted-foreground max-w-xs"
                                        value={searchItems}
                                        onChange={(e) => setSearchItems(e.target.value)}
                                        placeholder="Search items..."
                                    />
                                </div>

                                {/* Inventory panel */}
                                <div className="rounded-lg border border-border bg-secondary/10 p-2 h-[320px] overflow-y-auto overflow-x-hidden">
                                    {filteredInventory.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                            {loadingInv ? "Loading..." : "No items yet"}
                                        </div>
                                    ) : (
                                        <TooltipProvider delayDuration={200}>
                                            <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-1.5">
                                                {filteredInventory.map((it) => (
                                                    <Tooltip key={it.id}>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    addToOffer({
                                                                        key: it.assetid,
                                                                        contextid: it.contextid,
                                                                        appid: it.appid,
                                                                        name: it.name,
                                                                        image: it.image,
                                                                        link: "",
                                                                    })
                                                                }
                                                                className="group rounded-md border border-border bg-card overflow-hidden hover:border-primary/60 transition"
                                                                aria-label={it.name}
                                                            >
                                                                <img
                                                                    src={it.image}
                                                                    onError={(e) => (e.currentTarget.src = "/front/svg/default_item_icon.svg")}
                                                                    className="w-full aspect-square object-cover"
                                                                    alt={it.name}
                                                                />
                                                            </button>
                                                        </TooltipTrigger>

                                                        <TooltipContent side="top" align="center">
                                                            <span className="text-xs">{it.name}</span>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                        </TooltipProvider>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Right: chat */}
                    <div className="w-80 lg:w-96 flex flex-col">
                        <ScrollArea className="flex-1 p-4">
                            <div className="flex flex-col gap-2.5">
                                {/* Room ID bubble */}
                                <div className="flex justify-center mb-1">
                                    <div className="bg-primary/12 border border-primary/25 rounded-full px-5 py-2 text-center">
                                        <p className="text-xs font-mono text-primary">{"70e62d60-6616-48ff-9a69-847b300ae81f"}</p>
                                    </div>
                                </div>

                                {messages.map((msg) => {
                                    if (msg.type === "offer") return <OfferMessage key={msg.id} msg={msg} />;

                                    const style = MSG_STYLES[msg.type];
                                    return (
                                        <div key={msg.id} className={cn("rounded-lg px-3 py-2.5", style.bg)}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn("text-xs font-medium", style.accent)}>{msg.sender}</span>
                                                <span className="text-[10px] text-muted-foreground ml-auto">{msg.time}</span>
                                            </div>
                                            <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>

                        <div className="p-3 border-t border-border">
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Type message..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="flex-1 bg-secondary border-border rounded-lg h-10 text-sm placeholder:text-muted-foreground"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") sendMessage();
                                    }}
                                />
                                <button
                                    onClick={sendMessage}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Send message"
                                >
                                    <SendIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}



function OfferMessage({ msg }: { msg: ChatMessage }) {
    const hasAdded = msg.offerAdded && msg.offerAdded.length > 0;
    const hasRemoved = msg.offerRemoved && msg.offerRemoved.length > 0;
    const hasChanged = msg.offerChanged && msg.offerChanged.length > 0;

    return (
        <div className="rounded-lg px-3 py-3 bg-chart-3/8 border border-chart-3/15">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-chart-3/15 text-chart-3 px-2 py-0.5 rounded">
                    {msg.offerStatus}
                </span>
                <span className="text-[10px] text-muted-foreground">{msg.time}</span>
            </div>

            {msg.offerPrice != null && (
                <div className="mb-2">
                    <p className="text-sm font-semibold text-foreground">${msg.offerPrice}</p>
                    <p className="text-xs text-muted-foreground">{msg.offerItemCount} items</p>
                </div>
            )}

            {hasAdded && (
                <div className="mb-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                        <Plus className="h-3 w-3 text-chart-3" />
                        <span className="text-[10px] font-semibold text-chart-3 uppercase">Added</span>
                    </div>
                    {msg.offerAdded!.map((item, i) => (
                        <p key={i} className="text-xs text-foreground pl-4">
                            {"- "}
                            {item}
                        </p>
                    ))}
                </div>
            )}

            {hasRemoved && (
                <div className="mb-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                        <Minus className="h-3 w-3 text-destructive" />
                        <span className="text-[10px] font-semibold text-destructive uppercase">Removed</span>
                    </div>
                    {msg.offerRemoved!.map((item, i) => (
                        <p key={i} className="text-xs text-foreground pl-4">
                            {"- "}
                            {item}
                        </p>
                    ))}
                </div>
            )}

            {hasChanged && (
                <div>
                    <div className="flex items-center gap-1 mb-0.5">
                        <Repeat className="h-3 w-3 text-chart-4" />
                        <span className="text-[10px] font-semibold text-chart-4 uppercase">Changed</span>
                    </div>
                    {msg.offerChanged!.map((item, i) => (
                        <p key={i} className="text-xs text-foreground pl-4">
                            {"- "}
                            {item}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
