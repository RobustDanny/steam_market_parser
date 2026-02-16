"use client"

import { useState } from "react"
import {
    ArrowLeft,
    RefreshCw,
    ChevronDown,
    Send,
    Users,
    Bot,
    User,
    Store,
    DollarSign,
    Plus,
    Minus,
    Repeat,
    ShoppingBag,
    Check,
    ClipboardList,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ChatMessage {
    id: number
    type: "buyer" | "trader" | "system" | "offer"
    sender: string
    text?: string
    time: string
    // Offer-specific fields
    offerPrice?: number
    offerItemCount?: number
    offerStatus?: string
    offerAdded?: string[]
    offerRemoved?: string[]
    offerChanged?: string[]
}

const INITIAL_MESSAGES: ChatMessage[] = [
    {
        id: 1,
        type: "system",
        sender: "System",
        text: "Trade room opened. Waiting for both participants.",
        time: "10:01",
    },
    {
        id: 2,
        type: "system",
        sender: "System",
        text: "TRADER CONNECTED",
        time: "10:01",
    },
    {
        id: 3,
        type: "trader",
        sender: "Trader",
        text: "Hey, welcome! What items are you looking for?",
        time: "10:02",
    },
    {
        id: 4,
        type: "buyer",
        sender: "You",
        text: "Hi! I'm interested in the Elden Ring cards.",
        time: "10:02",
    },
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
    {
        id: 6,
        type: "trader",
        sender: "Trader",
        text: "Let me know if that works for you.",
        time: "10:03",
    },
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
    {
        id: 8,
        type: "system",
        sender: "System",
        text: "Reminder: verify items before paying.",
        time: "10:04",
    },
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
]

const MSG_STYLES: Record<string, { bg: string; accent: string; icon: React.ElementType }> = {
    buyer: { bg: "bg-primary/8", accent: "text-primary", icon: User },
    trader: { bg: "bg-accent/8", accent: "text-accent", icon: Store },
    system: { bg: "bg-muted/50", accent: "text-muted-foreground", icon: Bot },
    offer: { bg: "bg-chart-3/8", accent: "text-chart-3", icon: DollarSign },
}

// Store face items (bags with check marks)
const STORE_FACE_ITEMS = [
    { id: 1, checked: false },
    { id: 2, checked: true },
    { id: 3, checked: true },
    { id: 4, checked: true },
]

interface StoreModalProps {
    isOpen: boolean
    onClose: () => void
    storeName?: string
}

export function StoreModal({ isOpen, onClose, storeName = "Project Winter" }: StoreModalProps) {
    const [message, setMessage] = useState("")
    const [searchItems, setSearchItems] = useState("")
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)

    const sendMessage = () => {
        if (!message.trim()) return
        setMessages((prev) => [
            ...prev,
            {
                id: prev.length + 1,
                type: "buyer",
                sender: "You",
                text: message,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
        ])
        setMessage("")
    }

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
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
                            <button className="flex items-center gap-1.5 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors">
                                {storeName} (4)
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Refresh">
                                <RefreshCw className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                            <Users className="h-4 w-4" />
                            <span className="text-sm">Ppl before you</span>
                        </div>
                    </div>

                    {/* Center: status + actions */}
                    <div className="flex flex-col items-center justify-center gap-2 px-6 flex-1 border-r border-border">
                        <p className="text-sm text-muted-foreground">Waiting for both participants in room</p>
                        <div className="flex items-center gap-3">
                            <Button variant="secondary" className="rounded-lg px-8 h-9">
                                Send
                            </Button>
                            <Button variant="secondary" className="rounded-lg px-8 h-9">
                                Pay
                            </Button>
                        </div>
                    </div>

                    {/* Right: empty space (store face removed) */}
                    <div className="flex-1" />
                </div>

                {/* Content area */}
                <div className="flex flex-1 min-h-0">
                    {/* Left: offer area + items search */}
                    <div className="flex-1 flex flex-col border-r border-border">
                        {/* Offer zone */}
                        <div className="flex-1 border-b border-border p-4">
                            <div className="h-full rounded-lg bg-secondary/30 border border-border" />
                        </div>

                        {/* Items section */}
                        <div className="flex-1 p-4 flex flex-col">
                            <div className="rounded-lg bg-secondary/30 border border-border flex-1 flex flex-col p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <Input
                                        placeholder="Search items..."
                                        value={searchItems}
                                        onChange={(e) => setSearchItems(e.target.value)}
                                        className="max-w-xs bg-muted border-border rounded-lg h-9 text-sm placeholder:text-muted-foreground"
                                    />
                                </div>
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-sm text-muted-foreground">No items yet</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: chat */}
                    <div className="w-80 lg:w-96 flex flex-col">
                        <ScrollArea className="flex-1 p-4">
                            <div className="flex flex-col gap-2.5">
                                {/* Room ID bubble at top of chat */}
                                <div className="flex justify-center mb-1">
                                    <div className="bg-primary/12 border border-primary/25 rounded-full px-5 py-2 text-center">
                                        <p className="text-xs font-mono text-primary">
                                            {"70e62d60-6616-48ff-9a69-847b300ae81f"}
                                        </p>
                                    </div>
                                </div>

                                {messages.map((msg) => {
                                    // Render offer messages specially
                                    if (msg.type === "offer") {
                                        return <OfferMessage key={msg.id} msg={msg} />
                                    }

                                    const style = MSG_STYLES[msg.type]
                                    const Icon = style.icon
                                    return (
                                        <div key={msg.id} className={cn("rounded-lg px-3 py-2.5", style.bg)}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon className={cn("h-3.5 w-3.5", style.accent)} />
                                                <span className={cn("text-xs font-medium", style.accent)}>{msg.sender}</span>
                                                <span className="text-[10px] text-muted-foreground ml-auto">{msg.time}</span>
                                            </div>
                                            <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                                        </div>
                                    )
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
                                        if (e.key === "Enter") sendMessage()
                                    }}
                                />
                                <button
                                    onClick={sendMessage}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Send message"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

function OfferMessage({ msg }: { msg: ChatMessage }) {
    const hasAdded = msg.offerAdded && msg.offerAdded.length > 0
    const hasRemoved = msg.offerRemoved && msg.offerRemoved.length > 0
    const hasChanged = msg.offerChanged && msg.offerChanged.length > 0

    return (
        <div className="rounded-lg px-3 py-3 bg-chart-3/8 border border-chart-3/15">
            {/* Status badge */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-chart-3/15 text-chart-3 px-2 py-0.5 rounded">
                    {msg.offerStatus}
                </span>
                <span className="text-[10px] text-muted-foreground">{msg.time}</span>
            </div>

            {/* Price & count */}
            {msg.offerPrice != null && (
                <div className="mb-2">
                    <p className="text-sm font-semibold text-foreground">${msg.offerPrice}</p>
                    <p className="text-xs text-muted-foreground">{msg.offerItemCount} items</p>
                </div>
            )}

            {/* Added */}
            {hasAdded && (
                <div className="mb-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                        <Plus className="h-3 w-3 text-chart-3" />
                        <span className="text-[10px] font-semibold text-chart-3 uppercase">Added</span>
                    </div>
                    {msg.offerAdded!.map((item, i) => (
                        <p key={i} className="text-xs text-foreground pl-4">
                            {"- "}{item}
                        </p>
                    ))}
                </div>
            )}

            {/* Removed */}
            {hasRemoved && (
                <div className="mb-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                        <Minus className="h-3 w-3 text-destructive" />
                        <span className="text-[10px] font-semibold text-destructive uppercase">Removed</span>
                    </div>
                    {msg.offerRemoved!.map((item, i) => (
                        <p key={i} className="text-xs text-foreground pl-4">
                            {"- "}{item}
                        </p>
                    ))}
                </div>
            )}

            {/* Changed */}
            {hasChanged && (
                <div>
                    <div className="flex items-center gap-1 mb-0.5">
                        <Repeat className="h-3 w-3 text-chart-4" />
                        <span className="text-[10px] font-semibold text-chart-4 uppercase">Changed</span>
                    </div>
                    {msg.offerChanged!.map((item, i) => (
                        <p key={i} className="text-xs text-foreground pl-4">
                            {"- "}{item}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}
