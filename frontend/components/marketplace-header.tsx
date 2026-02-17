"use client"

import { useState } from "react"
import {
    Store,
    Bell,
    ChevronUp,
    ChevronDown,
    LayoutGrid,
    Megaphone,
    Heart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ProfileDropdown } from "@/components/profile-dropdown"
import { NotificationPopup } from "@/components/notification-popup"
import { ProfileSettingsPopup } from "@/components/profile-settings-popup"
import { StoreQuickPreview } from "@/components/store-preview-popup"
import { AdvertisePopup } from "@/components/advertise-popup"
import { useMe } from "@/hooks/userAuth"

interface MarketplaceHeaderProps {
    isOpen: boolean
    onToggle: () => void
    sidebarOpen: boolean
    stats: {
        totalItems: number
        avgPrice: number
        minPrice: number
        maxPrice: number
    }
    onOpenStoreModal: (params: { traderId: string; role: "buyer" | "trader" }) => void
}

export function MarketplaceHeader({
    isOpen,
    onToggle,
    sidebarOpen,
    stats,
    onOpenStoreModal,
}: MarketplaceHeaderProps) {
    const { steamUser } = useMe()
    const [profileOpen, setProfileOpen] = useState(false)
    const [notifOpen, setNotifOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [storeQueueOpen, setStoreQueueOpen] = useState(false)
    const [advertiseOpen, setAdvertiseOpen] = useState(false)

    const closeAll = () => {
        setProfileOpen(false)
        setNotifOpen(false)
        setStoreQueueOpen(false)
    }

    return (
        <>
            {/* Toggle button when header is collapsed */}
            <button
                onClick={onToggle}
                className={cn(
                    "fixed right-4 top-0 z-50 flex h-6 w-10 items-center justify-center rounded-b-md bg-card border border-t-0 border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-300",
                    isOpen && "opacity-0 pointer-events-none"
                )}
                aria-label="Open header"
            >
                <ChevronDown className="h-4 w-4" />
            </button>

            {/* Header bar */}
            <header
                className={cn(
                    "fixed top-0 right-0 z-30 h-14 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 transition-all duration-300 ease-in-out",
                    sidebarOpen ? "left-72" : "left-0",
                    isOpen ? "translate-y-0" : "-translate-y-full"
                )}
            >
                {/* Left section - main nav */}
                <TooltipProvider delayDuration={200}>
                    <nav className="flex items-center gap-1">
                        {/* <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Marketplace">
                                    <LayoutGrid className="h-5 w-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Marketplace</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Favorites">
                                    <Heart className="h-5 w-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Favorites</TooltipContent>
                        </Tooltip> */}
                    </nav>
                </TooltipProvider>

                {/* Center section - stats */}
                <div className="justify-self-center">
                    <div className="hidden md:flex items-center gap-5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Items:</span>
                            <span className="text-xs font-medium text-foreground">{stats.totalItems}</span>
                        </div>
                        <div className="h-3 w-px bg-border" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Avg:</span>
                            <span className="text-xs font-medium text-foreground">${stats.avgPrice.toFixed(2)}</span>
                        </div>
                        <div className="h-3 w-px bg-border" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Min:</span>
                            <span className="text-xs font-medium text-accent">${stats.minPrice}</span>
                        </div>
                        <div className="h-3 w-px bg-border" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Max:</span>
                            <span className="text-xs font-medium text-foreground">${stats.maxPrice}</span>
                        </div>
                    </div>
                </div>

                {/* Right section - profile & actions */}
                <div className="flex items-center gap-1">
                    {steamUser ? (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            setStoreQueueOpen(!storeQueueOpen)
                                            setNotifOpen(false)
                                            setProfileOpen(false)
                                        }}
                                        className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                        aria-label="Store"
                                    >
                                        <Store className="h-5 w-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Store</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            closeAll()
                                            setAdvertiseOpen(true)
                                        }}
                                        className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                        aria-label="Advertise"
                                    >
                                        <Megaphone className="h-5 w-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Advertise</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            setNotifOpen(!notifOpen)
                                            setProfileOpen(false)
                                            setStoreQueueOpen(false)
                                        }}
                                        className="relative flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                        aria-label="Notifications"
                                    >
                                        <Bell className="h-5 w-5" />
                                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Notifications</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (<></>)}

                    {/* Profile avatar */}
                    <button
                        onClick={() => {
                            setProfileOpen(!profileOpen)
                            setNotifOpen(false)
                            setStoreQueueOpen(false)
                        }}
                        className="ml-2 flex items-center justify-center h-8 w-8 rounded-full bg-primary/15 border border-primary/25 overflow-hidden hover:border-primary/40 transition-colors"
                        aria-label="Profile"
                    >
                        {steamUser?.avatar_url_full ? (
                            <img
                                src={steamUser.avatar_url_full}
                                alt={steamUser.nickname ?? "Profile"}
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <span className="text-primary text-xs font-bold">TR</span>
                        )}

                    </button>

                    {/* Collapse header button */}
                    <button
                        onClick={onToggle}
                        className="ml-1 flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label="Collapse header"
                    >
                        <ChevronUp className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* Popups */}

            <ProfileDropdown
                isOpen={profileOpen}
                onClose={() => setProfileOpen(false)}
                onOpenSettings={() => setSettingsOpen(true)}
                isAuthed={!!steamUser}
            />
            {steamUser ? (
                <>
                    <NotificationPopup
                        isOpen={notifOpen}
                        onClose={() => setNotifOpen(false)}
                    />
                    <ProfileSettingsPopup
                        isOpen={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                    />
                    <AdvertisePopup
                        isOpen={advertiseOpen}
                        onClose={() => setAdvertiseOpen(false)}
                        steamUser={{
                            steamid: steamUser.steamid,
                            nickname: steamUser.nickname ?? "",
                            avatar_url_full: steamUser.avatar_url_full ?? "",
                        }}
                    />
                </>
            ) : (<></>)}
            {/* Store icon opens Queue-only popup */}
            <StoreQuickPreview
                isOpen={storeQueueOpen}
                onClose={() => setStoreQueueOpen(false)}
                onOpenStore={() => {
                    setStoreQueueOpen(false);

                    if (!steamUser?.steamid) return; // just in case

                    onOpenStoreModal({
                        traderId: steamUser.steamid,  // ✅ OPEN MY STORE
                        role: "trader",               // ✅ I’m the trader in my own store
                    });
                }}
                storeName="Your Store"
            />
        </>
    )
}
