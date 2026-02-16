"use client"

import { MessageCircle } from "lucide-react"

export function ChatFab() {
    return (
        <button
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all duration-200 hover:shadow-primary/35 hover:scale-105"
            aria-label="Open chat"
        >
            <MessageCircle className="h-6 w-6" />
        </button>
    )
}
