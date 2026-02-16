"use client"

import { Package, DollarSign, Shield, MessageSquare } from "lucide-react"

interface NotificationPopupProps {
    isOpen: boolean
    onClose: () => void
}

const NOTIFICATIONS = [
    {
        id: 1,
        icon: DollarSign,
        title: "New offer received",
        description: "Someone offered $12 for Elden Ring card",
        time: "2m ago",
        color: "text-accent",
    },
    {
        id: 2,
        icon: Package,
        title: "Trade completed",
        description: "CS:GO bundle was delivered",
        time: "15m ago",
        color: "text-primary",
    },
    {
        id: 3,
        icon: MessageSquare,
        title: "New message",
        description: "buyer_42 sent you a message",
        time: "1h ago",
        color: "text-accent",
    },
    {
        id: 4,
        icon: Shield,
        title: "Security alert",
        description: "New login from Chrome on Windows",
        time: "3h ago",
        color: "text-destructive",
    },
]

export function NotificationPopup({ isOpen, onClose }: NotificationPopupProps) {
    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50" onClick={onClose} />
            <div className="fixed top-14 right-16 z-50 w-80 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-medium text-foreground">Notifications</h3>
                </div>
                <div className="max-h-72 overflow-y-auto">
                    {NOTIFICATIONS.map((n) => (
                        <button
                            key={n.id}
                            className="flex items-start gap-3 w-full px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                        >
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary ${n.color}`}>
                                <n.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{n.time}</span>
                        </button>
                    ))}
                </div>
            </div>
        </>
    )
}
