"use client"

import { Check, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ItemData {
    id: number
    title: string
    price: number | null
    type: "single" | "bundle"
    color: string
}

interface ItemCardProps {
    item: ItemData
    onBundleClick?: (item: ItemData) => void
}

export function ItemCard({ item, onBundleClick }: ItemCardProps) {
    const handleClick = () => {
        if (item.type === "bundle" && onBundleClick) {
            onBundleClick(item)
        }
    }

    return (
        <div
            onClick={handleClick}
            className={cn(
                "group relative flex flex-col rounded-lg bg-card border border-border overflow-hidden transition-all duration-200 hover:border-accent/50 hover:shadow-[0_0_16px_-4px_hsl(var(--accent)/0.15)]",
                item.type === "bundle" && "cursor-pointer"
            )}
        >
            {/* Action buttons top-right */}
            <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-card/80 border border-border text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Mark as owned"
                >
                    <Check className="h-2.5 w-2.5" />
                </button>
                <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-card/80 border border-border text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="More options"
                >
                    <MoreVertical className="h-2.5 w-2.5" />
                </button>
            </div>

            {/* Image area - smaller */}
            <div className="relative aspect-square flex items-center justify-center p-2">
                {item.type === "bundle" ? (
                    <BundleVisual color={item.color} />
                ) : (
                    <SingleCardVisual color={item.color} title={item.title} />
                )}
            </div>

            {/* Price */}
            {item.price !== null && (
                <div className="px-2 pb-2 pt-0">
                    <p className="text-center text-xs font-medium text-foreground">
                        ${item.price}
                    </p>
                </div>
            )}
        </div>
    )
}

function BundleVisual({ color }: { color: string }) {
    return (
        <div className="grid grid-cols-2 gap-1 w-full h-full p-0.5">
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="rounded flex items-center justify-center"
                    style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                >
                    <div
                        className="w-3/4 h-3/4 rounded-sm"
                        style={{ backgroundColor: `${color}25` }}
                    />
                </div>
            ))}
        </div>
    )
}

function SingleCardVisual({ color, title }: { color: string; title: string }) {
    return (
        <div
            className="relative w-3/4 h-full rounded flex flex-col items-center justify-center overflow-hidden"
            style={{ backgroundColor: `${color}15`, border: `1px solid ${color}35` }}
        >
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    background: `linear-gradient(135deg, ${color}40 0%, transparent 60%)`,
                }}
            />
            <div
                className="w-6 h-8 rounded-sm mb-1"
                style={{ backgroundColor: `${color}30` }}
            />
            <p className="text-[9px] text-muted-foreground font-medium truncate max-w-full px-1">
                {title}
            </p>
        </div>
    )
}
