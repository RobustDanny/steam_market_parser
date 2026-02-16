"use client"

import { X, Megaphone, Clock, Eye, DollarSign, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface AdvertisePopupProps {
    isOpen: boolean
    onClose: () => void
}

const ACTIVE_ADS = [
    { id: 1, title: "CS:GO Bundle x4", views: 234, clicks: 18, spent: 2.4, status: "Active" },
    { id: 2, title: "Elden Ring Card", views: 89, clicks: 5, spent: 0.8, status: "Active" },
]

export function AdvertisePopup({ isOpen, onClose }: AdvertisePopupProps) {
    const [adTitle, setAdTitle] = useState("")
    const [adBudget, setAdBudget] = useState("")

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl shadow-black/50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-primary" />
                        <h2 className="text-base font-semibold text-foreground">Advertise</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* Create new ad */}
                    <div className="mb-5">
                        <h3 className="text-sm font-medium text-foreground mb-3">Create Promotion</h3>
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block">Item / Store name</label>
                                <Input
                                    value={adTitle}
                                    onChange={(e) => setAdTitle(e.target.value)}
                                    placeholder="e.g. CS:GO Bundle x4"
                                    className="bg-secondary border-border rounded-lg h-9 text-sm placeholder:text-muted-foreground"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block">Daily budget ($)</label>
                                <Input
                                    value={adBudget}
                                    onChange={(e) => setAdBudget(e.target.value)}
                                    placeholder="5.00"
                                    type="number"
                                    className="bg-secondary border-border rounded-lg h-9 text-sm placeholder:text-muted-foreground"
                                />
                            </div>
                            <Button className="w-full rounded-lg h-9 bg-primary/80 hover:bg-primary/60 text-primary-foreground text-sm">
                                Start Promotion
                            </Button>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border mb-4" />

                    {/* Active ads */}
                    <div>
                        <h3 className="text-sm font-medium text-foreground mb-3">Active Promotions</h3>
                        <div className="flex flex-col gap-2">
                            {ACTIVE_ADS.map((ad) => (
                                <div key={ad.id} className="rounded-lg bg-secondary/50 border border-border p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-foreground">{ad.title}</p>
                                        <span className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded">
                                            {ad.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Eye className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{ad.views}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{ad.clicks} clicks</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">${ad.spent.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 ml-auto">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">24h</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
