"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { MarketplaceSidebar } from "@/components/marketplace-sidebar"
import { MarketplaceHeader } from "@/components/marketplace-header"
import { ItemCard, type ItemData } from "@/components/item-card"
import { ScrollControls } from "@/components/scroll-controls"
import { ChatFab } from "@/components/chat-fab"
import { StorePreviewPopup } from "@/components/store-preview-popup"
import { StoreModal } from "@/components/store-modal"
import { cn } from "@/lib/utils"

const ITEM_COLORS = [
    "#635bff",
    "#80e9ff",
    "#0a9dff",
    "#ff6059",
    "#a0f0d0",
    "#f5a623",
    "#e87de8",
    "#635bff",
    "#80e9ff",
    "#0a9dff",
]

const GAME_NAMES = [
    "Elden Ring",
    "CS:GO",
    "Monster Hunter",
    "Battlefront II",
    "Metal Gear",
    "Dark Souls III",
    "Touhou Project",
    "Worms W.M.D",
    "Ultraman",
    "Phantom Spark",
]

// Simple seeded PRNG for deterministic item generation (avoids hydration mismatch)
function seededRandom(seed: number) {
    let s = seed
    return () => {
        s = (s * 16807 + 0) % 2147483647
        return s / 2147483647
    }
}

function generateItems(): ItemData[] {
    const rng = seededRandom(42)
    const items: ItemData[] = []
    for (let i = 0; i < 48; i++) {
        const isBundle = rng() > 0.55
        const hasPrice = rng() > 0.25
        items.push({
            id: i,
            title: GAME_NAMES[i % GAME_NAMES.length],
            price: hasPrice ? Math.floor(rng() * 20) + 2 : null,
            type: isBundle ? "bundle" : "single",
            color: ITEM_COLORS[i % ITEM_COLORS.length],
        })
    }
    return items
}

const ITEMS = generateItems()

export default function Page() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [headerOpen, setHeaderOpen] = useState(true)
    const [storeModalOpen, setStoreModalOpen] = useState(false)
    const [storeModalName, setStoreModalName] = useState("Project Winter")
    // Full store preview popup (from bundle card click)
    const [bundlePreview, setBundlePreview] = useState<{ open: boolean; item: ItemData | null }>({
        open: false,
        item: null,
    })
    const gridRef = useRef<HTMLDivElement>(null)

    const scrollBy = useCallback((amount: number) => {
        gridRef.current?.scrollBy({ top: amount, behavior: "smooth" })
    }, [])

    const stats = useMemo(() => {
        const priced = ITEMS.filter((i) => i.price !== null)
        const prices = priced.map((i) => i.price as number)
        return {
            totalItems: ITEMS.length,
            avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            minPrice: prices.length > 0 ? Math.min(...prices) : 0,
            maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        }
    }, [])

    // Bundle card click -> full preview popup (Rating, Status, Queue, etc.)
    const handleBundleClick = useCallback((item: ItemData) => {
        setBundlePreview({ open: true, item })
    }, [])

    // From full preview popup -> open store modal
    const handleOpenStoreFromPreview = useCallback(() => {
        if (bundlePreview.item) {
            setStoreModalName(bundlePreview.item.title)
        }
        setBundlePreview({ open: false, item: null })
        setStoreModalOpen(true)
    }, [bundlePreview.item])

    // From header Store icon -> queue popup -> store modal
    const handleOpenStoreFromHeader = useCallback(() => {
        setStoreModalName("Featured Store")
        setStoreModalOpen(true)
    }, [])

    return (
        <div className="relative h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <MarketplaceSidebar
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
            />

            {/* Header */}
            <MarketplaceHeader
                isOpen={headerOpen}
                onToggle={() => setHeaderOpen(!headerOpen)}
                sidebarOpen={sidebarOpen}
                stats={stats}
                onOpenStoreModal={handleOpenStoreFromHeader}
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
                <div className="p-3 pr-16">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
                        {ITEMS.map((item) => (
                            <ItemCard
                                key={item.id}
                                item={item}
                                onBundleClick={handleBundleClick}
                            />
                        ))}
                    </div>
                </div>
            </main>

            {/* Right scroll controls (hideable) */}
            <ScrollControls
                onScrollUp={() => scrollBy(-400)}
                onScrollDown={() => scrollBy(400)}
            />

            {/* Chat FAB */}
            <ChatFab />

            {/* Bundle card click -> full store preview popup (Rating, Status, Queue, Avg times) */}
            <StorePreviewPopup
                isOpen={bundlePreview.open}
                onClose={() => setBundlePreview({ open: false, item: null })}
                onOpenStore={handleOpenStoreFromPreview}
                storeName={bundlePreview.item?.title ?? "Store"}
            />

            {/* Full store modal */}
            <StoreModal
                isOpen={storeModalOpen}
                onClose={() => setStoreModalOpen(false)}
                storeName={storeModalName}
            />
        </div>
    )
}