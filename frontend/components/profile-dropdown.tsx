"use client"

import { useState } from "react"
import { Wallet, Settings, LogOut, LogIn, X, CreditCard, Bitcoin } from "lucide-react"

interface ProfileDropdownProps {
    isOpen: boolean
    onClose: () => void
    onOpenSettings: () => void
    isAuthed: boolean
}

const WALLET_METHODS = [
    { id: "stripe", name: "Stripe", balance: 92.5, icon: CreditCard, color: "text-primary" },
    { id: "bitcoin", name: "Bitcoin", balance: 0.0018, icon: Bitcoin, color: "text-chart-4", unit: "BTC" },
]

export function ProfileDropdown({ isOpen, onClose, onOpenSettings, isAuthed }: ProfileDropdownProps) {
    const [walletOpen, setWalletOpen] = useState(false)

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50" onClick={() => { onClose(); setWalletOpen(false) }} />

            <div className="fixed top-14 right-4 z-50 w-56 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                <div className="py-1">
                    {isAuthed ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setWalletOpen(!walletOpen)}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary/30 transition-colors"
                            >
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                                Budget
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    onClose()
                                    setWalletOpen(false)
                                    onOpenSettings()
                                }}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary/30 transition-colors"
                            >
                                <Settings className="h-4 w-4 text-muted-foreground" />
                                Settings
                            </button>

                            <a
                                href="/api/logout"
                                onClick={() => {
                                    onClose()
                                    setWalletOpen(false)
                                }}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-secondary/30 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </a>
                        </>
                    ) : (
                        <a
                            href="/api/auth/steam"
                            onClick={() => {
                                onClose()
                                setWalletOpen(false)
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary/30 transition-colors"
                        >
                            <LogIn className="h-4 w-4 text-muted-foreground" />
                            Steam Login
                        </a>
                    )}
                </div>
            </div>

            {walletOpen && (
                <div className="fixed top-14 right-64 z-50 w-64 rounded-xl bg-card border border-border shadow-2xl shadow-black/40 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <h3 className="text-sm font-medium text-foreground">Wallet</h3>
                        <button
                            type="button"
                            onClick={() => setWalletOpen(false)}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Close wallet"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="p-3">
                        {WALLET_METHODS.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-secondary/30 transition-colors">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-secondary border border-border ${m.color}`}>
                                    <m.icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">{m.name}</p>
                                    <p className="text-sm font-medium text-foreground">
                                        {m.unit ? `${m.balance} ${m.unit}` : `$${m.balance.toFixed(2)}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}
