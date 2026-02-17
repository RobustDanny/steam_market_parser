"use client"

import { useState } from "react"
import {
    Sparkles,
    BarChart3,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface MarketplaceSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onApplyFilters: (f: {
        appid: string;
        price_min: string;
        price_max: string;
        query: string;
        card_appearing: string;
    }) => void;
}

export function MarketplaceSidebar({ isOpen, onToggle, onApplyFilters }: MarketplaceSidebarProps) {
    const [gameFilter, setGameFilter] = useState("")
    const [queryFilter, setQueryFilter] = useState("")
    const [priceMin, setPriceMin] = useState([0])
    const [priceMax, setPriceMax] = useState([9999999])
    const [filterType, setFilterType] = useState("stores-and-items")

    return (
        <>
            {/* Toggle button when sidebar is closed */}
            <button
                onClick={onToggle}
                className={cn(
                    "fixed left-0 top-1/2 z-50 -translate-y-1/2 flex h-10 w-6 items-center justify-center rounded-r-md bg-card border border-l-0 border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-300",
                    isOpen && "opacity-0 pointer-events-none"
                )}
                aria-label="Open sidebar"
            >
                <ChevronRight className="h-4 w-4" />
            </button>

            {/* Sidebar panel */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 h-full w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Close toggle */}
                <button
                    onClick={onToggle}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Close sidebar"
                >
                    <ChevronLeft className="h-3 w-3" />
                </button>

                <ScrollArea className="flex-1">
                    <div className="p-5">
                        {/* Game filter */}
                        <div className="mb-3">
                            <Input
                                placeholder="Enter a game"
                                value={gameFilter}
                                onChange={(e) => setGameFilter(e.target.value)}
                                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-full h-9 text-sm"
                            />
                        </div>

                        {/* Query filter */}
                        <div className="mb-5">
                            <Input
                                placeholder="Enter a query"
                                value={queryFilter}
                                onChange={(e) => setQueryFilter(e.target.value)}
                                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-full h-9 text-sm"
                            />
                        </div>

                        {/* Price min slider */}
                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center bg-secondary border border-border rounded-full px-3 py-1.5 min-w-[80px]">
                                    <span className="text-muted-foreground text-sm mr-1">$</span>
                                    <span className="text-foreground text-sm">{priceMin[0]}</span>
                                </div>
                                <Slider
                                    value={priceMin}
                                    onValueChange={setPriceMin}
                                    max={10000}
                                    step={1}
                                    className="flex-1 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_[data-orientation=horizontal]>[data-orientation=horizontal]]:bg-primary"
                                />
                            </div>
                        </div>

                        {/* Price max slider */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center bg-secondary border border-border rounded-full px-3 py-1.5 min-w-[80px]">
                                    <span className="text-muted-foreground text-sm mr-1">$</span>
                                    <span className="text-foreground text-sm">{priceMax[0]}</span>
                                </div>
                                <Slider
                                    value={priceMax}
                                    onValueChange={setPriceMax}
                                    max={9999999}
                                    step={100}
                                    className="flex-1 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_[data-orientation=horizontal]>[data-orientation=horizontal]]:bg-primary"
                                />
                            </div>
                        </div>

                        {/* Filter type radio */}
                        <RadioGroup
                            value={filterType}
                            onValueChange={setFilterType}
                            className="gap-4 mb-6"
                        >
                            <div className="flex items-center gap-3">
                                <RadioGroupItem
                                    value="stores-and-items"
                                    id="stores-and-items"
                                    className="border-primary text-primary data-[state=checked]:border-primary data-[state=checked]:text-primary"
                                />
                                <label htmlFor="stores-and-items" className="text-sm font-medium text-foreground cursor-pointer">
                                    Stores and items
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                <RadioGroupItem
                                    value="only-stores"
                                    id="only-stores"
                                    className="border-muted-foreground text-primary"
                                />
                                <label htmlFor="only-stores" className="text-sm font-medium text-foreground cursor-pointer">
                                    Only stores
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                <RadioGroupItem
                                    value="only-items"
                                    id="only-items"
                                    className="border-muted-foreground text-primary"
                                />
                                <label htmlFor="only-items" className="text-sm font-medium text-foreground cursor-pointer">
                                    Only items
                                </label>
                            </div>
                        </RadioGroup>

                        {/* Apply button */}
                        <Button
                            onClick={() => onApplyFilters({
                                appid: gameFilter || "Steam",
                                price_min: String(priceMin[0]),
                                price_max: String(priceMax[0]),
                                query: queryFilter,
                                card_appearing:
                                    filterType === "stores-and-items" ? "stores_items"
                                        : filterType === "only-stores" ? "stores"
                                            : "items",
                            })}
                            className="w-full rounded-full bg-primary hover:bg-primary/80 text-primary-foreground font-medium h-10"
                        >
                            Apply
                        </Button>

                        {/* <div className="h-px bg-border mt-5" /> */}
                    </div>
                </ScrollArea>

                {/* Bottom navigation & footer */}
                <div className="p-5 border-t border-sidebar-border">
                    <div className="flex items-center justify-center gap-6 mb-4">
                        <button className="text-muted-foreground hover:text-accent transition-colors" aria-label="Trending">
                            <Sparkles className="h-5 w-5" />
                        </button>
                        <button className="text-muted-foreground hover:text-accent transition-colors" aria-label="Analytics">
                            <BarChart3 className="h-5 w-5" />
                        </button>
                        <button className="text-muted-foreground hover:text-accent transition-colors" aria-label="Messages">
                            <MessageSquare className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-muted-foreground text-xs text-center mb-1">
                        support@tastyrock.com
                    </p>
                    <p className="text-muted-foreground text-xs text-center">
                        {'© 2026 TastyRock inc.'}
                    </p>
                </div>
            </aside>
        </>
    )
}
