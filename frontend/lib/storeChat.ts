// lib/storeChat.ts
export type Role = "buyer" | "trader";

export type PresenceMsg = {
    type: "presence";
    count?: number;
    buyer_present?: boolean;
    trader_present?: boolean;
    offer_id?: string | null;
};

export type ChatMsg = {
    type: "chat" | "system" | "offer_system" | "offer_log" | "item_asking" | "offer_items" | "offer_step" | "set_offer" | "reveal_send_offer" | "send_offer" | "accept_offer" | "pay_offer";
    text?: string;
    from_role?: Role | "system";
    offer_id?: string;
    step?: "connect" | "accept" | "pay";
    items?: any[];
    offer_dirty?: boolean;
    offer_send?: boolean;
    offer_accepted?: boolean;
    offer_paid?: boolean;
};

export function buildWsUrl(buyerId: string, traderId: string, role: Role) {
    const base =
        typeof window !== "undefined"
            ? (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host
            : "ws://127.0.0.1:8080";
    return `${base}/ws/chat?buyer=${encodeURIComponent(buyerId)}&trader=${encodeURIComponent(traderId)}&role=${encodeURIComponent(role)}`;
}
