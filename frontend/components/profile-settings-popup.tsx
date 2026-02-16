"use client"

import { useState } from "react"
import { X, CreditCard, Bitcoin, Search, RotateCcw, Save, Unplug } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ProfileSettingsPopupProps {
    isOpen: boolean
    onClose: () => void
}

const PAYMENT_METHODS = [
    {
        id: "stripe",
        name: "Stripe",
        description: "Connect your Stripe account",
        icon: CreditCard,
        color: "bg-primary/12 text-primary",
    },
    {
        id: "bitcoin",
        name: "Bitcoin",
        description: "Connect your Bitcoin wallet",
        icon: Bitcoin,
        color: "bg-chart-4/12 text-chart-4",
    },
]

export function ProfileSettingsPopup({ isOpen, onClose }: ProfileSettingsPopupProps) {
    const [email, setEmail] = useState("user@tastyrock.com")
    const [tradeUrl, setTradeUrl] = useState("")
    const [paymentSearch, setPaymentSearch] = useState("")
    const [connectedMethods, setConnectedMethods] = useState<Set<string>>(new Set(["stripe"]))

    const filteredMethods = PAYMENT_METHODS.filter((m) =>
        m.name.toLowerCase().includes(paymentSearch.toLowerCase())
    )

    const toggleConnection = (id: string) => {
        setConnectedMethods((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const handleReset = () => {
        setEmail("user@tastyrock.com")
        setTradeUrl("")
    }

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl shadow-black/50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">Profile Settings</h2>
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
                    {/* Main info */}
                    <div className="flex flex-col gap-3 mb-5">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                            <Input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-secondary border-border rounded-lg h-9 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1.5 block">Trade URL</label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={tradeUrl}
                                    onChange={(e) => setTradeUrl(e.target.value)}
                                    placeholder="Enter your trade URL"
                                    className="flex-1 bg-secondary border-border rounded-lg h-9 text-sm placeholder:text-muted-foreground"
                                />
                                <button
                                    onClick={handleReset}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    aria-label="Reset"
                                    title="Reset"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                                    aria-label="Save"
                                    title="Save"
                                >
                                    <Save className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border mb-4" />

                    {/* Payment Methods */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-foreground">Payment Methods</h3>
                        </div>

                        {/* Payment search bar */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search payment methods..."
                                value={paymentSearch}
                                onChange={(e) => setPaymentSearch(e.target.value)}
                                className="bg-secondary border-border rounded-lg h-9 text-sm pl-9 placeholder:text-muted-foreground"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            {filteredMethods.map((method) => {
                                const isConnected = connectedMethods.has(method.id)
                                return (
                                    <div
                                        key={method.id}
                                        className={cn(
                                            "flex items-center gap-3 w-full rounded-lg border px-4 py-3 transition-colors",
                                            isConnected
                                                ? "bg-secondary/50 border-primary/20"
                                                : "bg-secondary border-border hover:bg-muted"
                                        )}
                                    >
                                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", method.color)}>
                                            <method.icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-sm font-medium text-foreground">{method.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {isConnected ? "Connected" : method.description}
                                            </p>
                                        </div>
                                        {isConnected ? (
                                            <button
                                                onClick={() => toggleConnection(method.id)}
                                                className="flex items-center gap-1.5 text-xs text-destructive/80 hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/8"
                                                title="Disconnect"
                                            >
                                                <Unplug className="h-3.5 w-3.5" />
                                                <span>Reset</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => toggleConnection(method.id)}
                                                className="text-xs text-accent hover:text-accent/80 font-medium transition-colors px-2 py-1"
                                            >
                                                Connect
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                            {filteredMethods.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No payment methods found</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
