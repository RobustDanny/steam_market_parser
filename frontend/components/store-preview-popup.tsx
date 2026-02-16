"use client"

import { Star, Clock, DollarSign, Users, Activity, LogIn } from "lucide-react"

interface StorePopupProps {
    isOpen: boolean
    onClose: () => void
    onOpenStore: () => void
    storeName?: string
}

/**
 * Full store preview with Rating, Status, Queue, Avg offer time, Avg offer price.
 * Shown when clicking a bundle card (4-window card).
 */
export function StorePreviewPopup({
    isOpen,
    onClose,
    onOpenStore,
    storeName = "Store",
}: StorePopupProps) {
    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                <div className="p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-medium text-foreground">{storeName}</h3>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Star className="h-4 w-4" />
                                <span className="text-sm">Rating</span>
                            </div>
                            <span className="text-sm text-foreground">4.8</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Activity className="h-4 w-4" />
                                <span className="text-sm">Status</span>
                            </div>
                            <span className="text-sm text-accent">Online</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span className="text-sm">Queue</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-foreground">3</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOpenStore()
                                    }}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    aria-label="Enter store"
                                >
                                    <LogIn className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span className="text-sm">Avg offer time</span>
                            </div>
                            <span className="text-sm text-foreground">2m 30s</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <DollarSign className="h-4 w-4" />
                                <span className="text-sm">Avg offer price</span>
                            </div>
                            <span className="text-sm text-foreground">$8.50</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

/**
 * Small queue-only popup. Shown when clicking the Store icon in the header bar.
 */
export function StoreQuickPreview({
    isOpen,
    onClose,
    onOpenStore,
    storeName = "Store",
}: StorePopupProps) {
    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-72 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                <div className="p-5">
                    <p className="text-xs text-muted-foreground mb-3">{storeName}</p>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Queue</span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">3 ahead</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onOpenStore()
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                aria-label="Enter store"
                            >
                                <LogIn className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
