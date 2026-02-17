"use client";

import { Star, Clock, DollarSign, Users, Activity, LogIn } from "lucide-react";

interface StorePreviewPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenStore: (storeSteamId?: string | null) => void;
    storeName?: string;
    storeSteamId?: string | null;
}

export function StorePreviewPopup({
    isOpen,
    onClose,
    onOpenStore,
    storeName = "Store",
    storeSteamId,
}: StorePreviewPopupProps) {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                <div className="p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-medium text-foreground">{storeName}</h3>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Row icon={<Star className="h-4 w-4" />} label="Rating" value="4.8" />
                        <Row
                            icon={<Activity className="h-4 w-4" />}
                            label="Status"
                            value={<span className="text-accent">Online</span>}
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span className="text-sm">Queue</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-sm text-foreground">3</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenStore(storeSteamId); // ✅ triggers fetch in Page
                                    }}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    aria-label="Enter store"
                                >
                                    <LogIn className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <Row icon={<Clock className="h-4 w-4" />} label="Avg offer time" value="2m 30s" />
                        <Row icon={<DollarSign className="h-4 w-4" />} label="Avg offer price" value="$8.50" />
                    </div>
                </div>
            </div>
        </>
    );
}

function Row({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-sm">{label}</span>
            </div>
            <span className="text-sm text-foreground">{value}</span>
        </div>
    );
}



/**
 * Small queue-only popup. Shown when clicking the Store icon in the header bar.
 */

type StoreQuickPreviewProps = {
    isOpen: boolean;
    onClose: () => void;
    onOpenStore: (storeSteamId?: string | null) => void;
    storeName?: string;
    storeSteamId?: string | null;
};

export function StoreQuickPreview({
    isOpen,
    onClose,
    onOpenStore,
    storeName = "Store",
    storeSteamId,
}: StoreQuickPreviewProps) {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-72 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                <div className="p-5">
                    <p className="text-xs text-muted-foreground mb-3">{storeName}</p>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Queue</span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">3 ahead</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenStore(storeSteamId);
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
    );
}