"use client"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { MarketplaceSidebar } from "@/components/marketplace-sidebar"
import { MarketplaceHeader } from "@/components/marketplace-header"
import { ItemCard, type ItemCardData } from "@/components/feed-card"
import { useMe } from "@/hooks/userAuth"
// import { ScrollControls } from "@/components/scroll-controls"
// import { ChatFab } from "@/components/chat-fab"
import { StorePreviewPopup } from "@/components/store-preview-popup"
import { StoreModal } from "@/components/store-modal"
import { FeedCard, MostRecent, UserProfileAds } from "@/types/feed"
import { getInventoryGames, type InventoryGame } from "@/lib/getInventoryGames";
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function AnimatedCard({
    children,
    className,
    enabled = true,
}: {
    children: React.ReactNode;
    className?: string;
    enabled?: boolean;
}) {
    const [entered, setEntered] = useState(!enabled);

    useEffect(() => {
        if (!enabled) return;
        // next paint -> transition in
        const id = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(id);
    }, [enabled]);

    return (
        <div
            className={cn(
                "will-change-transform will-change-opacity",
                enabled &&
                "transition-all duration-200 ease-out motion-reduce:transition-none",
                enabled && (entered ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.98]"),
                className
            )}
        >
            {children}
        </div>
    );
}

function AdCard({
    ad,
    onClick,
}: {
    ad: UserProfileAds
    onClick?: (ad: UserProfileAds) => void
}) {
    const imgs = [ad.first_item_image, ad.second_item_image, ad.third_item_image, ad.fourth_item_image];

    return (
        <div
            onClick={() => onClick?.(ad)}
            className={cn(
                "rounded-lg bg-card border border-border overflow-hidden p-2",
                onClick && "cursor-pointer hover:border-accent/50 hover:shadow-[0_0_16px_-4px_hsl(var(--accent)/0.15)] transition-all"
            )}
        >
            <div className="grid grid-cols-2 gap-1">
                {imgs.map((src, i) => (
                    <img key={i} src={src} className="w-full h-auto rounded" alt="" />
                ))}
            </div>
        </div>
    );
}

type CardEntry = { key: string; card: FeedCard };




// const ITEM_COLORS = [
//     "#635bff",
//     "#80e9ff",
//     "#0a9dff",
//     "#ff6059",
//     "#a0f0d0",
//     "#f5a623",
//     "#e87de8",
//     "#635bff",
//     "#80e9ff",
//     "#0a9dff",
// ]

// const GAME_NAMES = [
//     "Elden Ring",
//     "CS:GO",
//     "Monster Hunter",
//     "Battlefront II",
//     "Metal Gear",
//     "Dark Souls III",
//     "Touhou Project",
//     "Worms W.M.D",
//     "Ultraman",
//     "Phantom Spark",
// ]

export function sendFilters(ws: WebSocket | null, f: {
    appid: string; price_min: string; price_max: string; query: string; card_appearing: string;
}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "filters", ...f }));
}

const PAGE_SIZE = 200;

function wsUrl(path: string) {
    if (typeof window === "undefined") return path;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}${path}`;
}

// Rust WS item -> your ItemData
function mapRustItemToItemData(it: any): ItemCardData {
    // TODO: change these keys to match your real Rust JSON
    return {
        id: it.id ?? (it.market_hash_name ? hashStr(it.market_hash_name) : Math.floor(Math.random() * 1e9)),
        title: it.name ?? it.title ?? "Unknown",
        price: (it.converted_price ?? it.price ?? null),
        type: "single",                 // or "bundle" if you have that concept
        color: "#A8DADC",               // or derive by game/appid if you want
    };
}

// small stable hash for missing numeric ids
function hashStr(s: string) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0);
}

async function addBuyerToQueue(traderId: string, buyerId: string) {
    const res = await fetch("/api/add_to_store_queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // IMPORTANT: your backend expects buyer_id / trader_id (snake_case)
        body: JSON.stringify({ buyer_id: buyerId, trader_id: traderId }),
        // include cookies if your session auth relies on them
        credentials: "include",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`add_to_store_queue failed: ${res.status} ${text}`);
    }

    return res.json();
}

async function removeFromStoreQueue(traderId: string): Promise<{ buyer_id: string | null }> {
    const res = await fetch("/api/remove_from_store_queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trader_id: traderId }),
        credentials: "include",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`remove_from_store_queue failed: ${res.status} ${text}`);
    }

    return res.json();
}



export default function Page() {
    const { steamUser } = useMe();
    const [cards, setCards] = useState<CardEntry[]>([]);
    const pausedBufferRef = useRef<CardEntry[]>([]);
    const [currentPage, setCurrentPage] = useState(0);  // 0 = newest
    const [isPaused, setIsPaused] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [headerOpen, setHeaderOpen] = useState(true)
    const [storeModalOpen, setStoreModalOpen] = useState(false)
    const [storeModalName, setStoreModalName] = useState("Project Winter")
    const mainWsRef = useRef<WebSocket | null>(null);
    const seenRef = useRef<Set<string>>(new Set());
    const [storeSteamId, setStoreSteamId] = useState<string | null>(null);
    const [storeGames, setStoreGames] = useState<InventoryGame[]>([]);
    const [activeBuyerId, setActiveBuyerId] = useState<string | null>(null);

    const openStore = useCallback(
        async (traderSteamId: string, storeName: string) => {
            const buyerSteamId = steamUser?.steamid;
            if (!buyerSteamId) return;
            if (!traderSteamId) return;

            // If trader clicks his own store card: do nothing (same as old JS)
            if (traderSteamId === buyerSteamId) {
                console.log("Equal");
                return;
            }

            // ✅ Queue first (matches old JS: add_buyser_to_queue on enter_store)
            try {
                const json = await addBuyerToQueue(traderSteamId, buyerSteamId);
                console.log("Buyer added to queue:", json);
            } catch (e) {
                console.error("add_to_store_queue error:", e);
                // up to you: either continue opening store or abort
                // return; // uncomment if you want to block opening store on failure
            }

            setStoreGames([]); // avoid stale UI

            try {
                const list = await getInventoryGames(traderSteamId);
                setStoreGames(list ?? []);
            } catch (e) {
                console.error(e);
                setStoreGames([]);
            }

            setStoreModalName(storeName);
            setStoreSteamId(traderSteamId);
            setStoreModalOpen(true);
        },
        [steamUser]
    );

    const openStoreAs = useCallback(
        async (params: { traderId: string; role: "buyer" | "trader"; storeName?: string }) => {
            const traderSteamId = params.traderId;
            if (!traderSteamId) return;

            // BUYER flow (your existing one)
            if (params.role === "buyer") {
                await openStore(traderSteamId, params.storeName ?? "Store");
                return;
            }

            // ✅ TRADER flow (this matches old enter_my_store)
            try {
                const result = await removeFromStoreQueue(traderSteamId);
                console.log("Buyer removed from queue:", result.buyer_id);

                // Open store UI
                setStoreGames([]);
                try {
                    const list = await getInventoryGames(traderSteamId);
                    setStoreGames(list ?? []);
                } catch (e) {
                    console.error(e);
                    setStoreGames([]);
                }

                setStoreModalName(params.storeName ?? "Your Store");
                setStoreSteamId(traderSteamId);
                setStoreModalOpen(true);

                // If your StoreModal / WS needs buyerId, store it.
                // If no buyer exists, keep it null and handle "no buyer" in UI/WS.
                setActiveBuyerId(result.buyer_id ?? null);
            } catch (e) {
                console.error(e);
                // optional: still open store even if queue pop fails
                // setStoreModalOpen(true) ...
            }
        },
        [openStore]
    );

    const buyerId = steamUser?.steamid ?? null;
    const traderId = storeSteamId ?? null;

    // who is the "buyer" in the StoreModal?
    // - if role=buyer: buyer is me
    // - if role=trader: buyer is dequeued
    const modalRole = storeSteamId && steamUser?.steamid === storeSteamId ? "trader" : "buyer";
    const modalBuyerId = modalRole === "buyer" ? (steamUser?.steamid ?? null) : activeBuyerId;

    // console.log("buyerId", buyerId)
    // console.log("traderId", traderId)

    // Full store preview popup (from bundle card click)
    const [bundlePreview, setBundlePreview] = useState<{ open: boolean; item: ItemCardData | null }>({
        open: false,
        item: null,
    })
    const handleAdClick = useCallback((ad: UserProfileAds) => {
        setStoreSteamId(ad.steamid);
        const name = ad.nickname ?? "";

        setBundlePreview({
            open: true,
            item: {
                id: Number(hashStr(ad.steamid)),
                title: name,
                price: null,
                type: "bundle",
                color: "#A8DADC",
            },
        });
    }, []);

    const gridRef = useRef<HTMLDivElement>(null)
    const cardAdAppearingRef = useRef<string>("stores_items");

    const totalPages = useMemo(() => Math.max(1, Math.ceil(cards.length / PAGE_SIZE)), [cards.length]);

    const adSeqRef = useRef(0);

    function makeAdKey(ad: UserProfileAds) {
        adSeqRef.current += 1;
        // stable enough + guaranteed unique on this client
        return `ad:${ad.steamid}:${Date.now()}:${adSeqRef.current}`;
    }

    function makeItemKey(it: MostRecent) {
        // your listinginfo_id is good
        return `it:${it.listinginfo_id}`;
    }

    const pageItems = useMemo(() => {
        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return cards.slice(start, end);
    }, [cards, currentPage]);

    const onApplyFilters = useCallback((f: {
        appid: string; price_min: string; price_max: string; query: string; card_appearing: string;
    }) => {
        const ws = mainWsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "filters", ...f }));

        // optional: clear existing cards when filters change (matches typical UX)
        // setCards([]);
        pausedBufferRef.current = [];
        setCurrentPage(0);
    }, []);

    const addNewest = useCallback((entry: CardEntry) => {
        setCards(prev => {
            setCurrentPage(p => (p > 0 ? p + 1 : p));
            return [entry, ...prev];
        });
    }, []);


    const flushPaused = useCallback(() => {
        const buf = pausedBufferRef.current;
        if (!buf.length) return;
        setCards(prev => [...buf, ...prev]);
        pausedBufferRef.current = [];
    }, []);

    function getCardKey(c: FeedCard) {
        return c.kind === "ad"
            ? `ad:${c.data.steamid}:${c.data.first_item_image}`
            : `it:${c.data.listinginfo_id}`;
    }

    const isPausedRef = useRef(false);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

    useEffect(() => {
        const main = new WebSocket(wsUrl("/ws"));
        const ads = new WebSocket(wsUrl("/ws/ads"));

        // optional: store refs so you can send filters later
        mainWsRef.current = main;

        main.onopen = () => console.log("main_ws CONNECTED");
        main.onclose = () => console.log("main_ws CLOSED");
        main.onerror = (e) => console.log("main_ws ERROR", e);

        ads.onopen = () => console.log("ad_main_ws CONNECTED");
        ads.onclose = () => console.log("ad_main_ws CLOSED");
        ads.onerror = (e) => console.log("ad_main_ws ERROR", e);

        ads.onmessage = (event) => {
            console.log("ads ws")
            const payload = JSON.parse(event.data) as { user_ads?: UserProfileAds[] };
            const ad0 = payload.user_ads?.[0];
            if (!ad0) return;

            // respect your card_appearing behavior
            if (cardAdAppearingRef.current !== "stores" && cardAdAppearingRef.current !== "stores_items") return;

            const entry: CardEntry = { key: makeAdKey(ad0), card: { kind: "ad", data: ad0 } };

            if (isPausedRef.current) pausedBufferRef.current.unshift(entry);
            else addNewest(entry);
        };

        main.onmessage = (event) => {
            console.log("main ws")
            const payload = JSON.parse(event.data);

            // server echoes filters
            if (payload?.type === "filters" && payload?.card_appearing) {
                cardAdAppearingRef.current = payload.card_appearing;
                return;
            }

            const arr: MostRecent[] = payload?.items ?? [];
            if (!arr.length) return;

            // preserve your ordering logic
            const mapped: CardEntry[] = arr.map((it) => ({
                key: makeItemKey(it),
                card: { kind: "item", data: it },
            }));

            if (isPausedRef.current) {
                for (let i = mapped.length - 1; i >= 0; i--) pausedBufferRef.current.unshift(mapped[i]);
                return;
            }
            for (let i = mapped.length - 1; i >= 0; i--) addNewest(mapped[i]);
        };

        return () => {
            mainWsRef.current = null;
            main.close();
            ads.close();
        };
    }, [addNewest]);

    const stats = useMemo(() => {
        const itemCards = cards.filter(
            (c): c is CardEntry & { card: { kind: "item"; data: MostRecent } } =>
                c.card.kind === "item"
        );
        const prices = itemCards
            .map((c) => Number.parseFloat(c.card.data.converted_price))
            .filter((n) => Number.isFinite(n));

        return {
            totalItems: itemCards.length,
            avgPrice: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            minPrice: prices.length ? Math.min(...prices) : 0,
            maxPrice: prices.length ? Math.max(...prices) : 0,
        };
    }, [cards]);


    // Bundle card click -> full preview popup (Rating, Status, Queue, etc.)
    const handleBundleClick = useCallback((item: ItemCardData) => {
        setBundlePreview({ open: true, item })
    }, [])

    // From full preview popup -> open store modal
    const handleOpenStoreFromPreview = useCallback(
        async (sid?: string | null) => {
            const traderSteamId = sid ?? storeSteamId;
            if (!traderSteamId) return;

            setBundlePreview({ open: false, item: null });

            await openStore(traderSteamId, bundlePreview.item?.title ?? "Store");
        },
        [storeSteamId, bundlePreview.item, openStore]
    );

    // From header Store icon -> queue popup -> store modal
    const handleOpenStoreFromHeader = useCallback(async () => {
        const mySteamId = steamUser?.steamid;
        if (!mySteamId) return;

        await openStore(mySteamId, steamUser?.nickname ?? "My Store");
    }, [steamUser, openStore]);


    function mapMostRecentToItemCardData(it: MostRecent): ItemCardData {
        const priceNum = Number.parseFloat(it.converted_price);
        return {
            id: it.id,
            title: it.name,
            price: Number.isFinite(priceNum) ? priceNum : null,
            type: "single",
            color: "#A8DADC",
            appid: it.appid,
            market_hash_name: it.market_hash_name,
            icon: it.icon,
            game_icon: it.game_icon,
            tradable: it.tradable === "1",
        };
    }




    return (
        <div className="relative h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <MarketplaceSidebar
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                onApplyFilters={onApplyFilters}
            />

            {/* Header */}
            <MarketplaceHeader
                isOpen={headerOpen}
                onToggle={() => setHeaderOpen(!headerOpen)}
                sidebarOpen={sidebarOpen}
                stats={stats}
                onOpenStoreModal={openStoreAs}
            />

            {/* Main content area */}
            <main
                ref={gridRef}
                className={cn(
                    "h-full overflow-y-auto transition-all duration-300 ease-in-out",
                    sidebarOpen ? "ml-72" : "ml-0",
                    headerOpen ? "pt-14" : "pt-0"
                )}
            >

                <div className="p-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
                        {pageItems.map((e) => {
                            const k = e.key;
                            const c = e.card;

                            const seen = seenRef.current.has(k);
                            if (!seen) seenRef.current.add(k);

                            return (
                                <AnimatedCard key={k} enabled={!seen}>
                                    {c.kind === "ad" ? (
                                        <AdCard ad={c.data} onClick={handleAdClick} />
                                    ) : (
                                        <ItemCard
                                            item={mapMostRecentToItemCardData(c.data)}
                                            onBundleClick={handleBundleClick}
                                        />
                                    )}
                                </AnimatedCard>
                            );
                        })}
                    </div>
                </div>

            </main>

            {/* Right scroll controls (hideable) */}
            {/* <ScrollControls
                onScrollUp={() => scrollBy(-400)}
                onScrollDown={() => scrollBy(400)}
            /> */}

            {/* Chat FAB */}
            {/* <ChatFab /> */}

            {/* Bundle card click -> full store preview popup (Rating, Status, Queue, Avg times) */}
            <StorePreviewPopup
                isOpen={bundlePreview.open}
                onClose={() => setBundlePreview({ open: false, item: null })}
                onOpenStore={handleOpenStoreFromPreview}
                storeSteamId={storeSteamId}
            />
            {/* Full store modal */}

            {storeModalOpen && traderId && modalBuyerId && (
                <StoreModal
                    isOpen={storeModalOpen}
                    onClose={() => setStoreModalOpen(false)}
                    storeName={storeModalName}
                    buyerId={modalBuyerId}
                    traderId={traderId}
                    role={modalRole}
                    initialGames={storeGames}
                />
            )}
        </div >
    )
}