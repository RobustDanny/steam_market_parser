"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMsg, PresenceMsg, Role } from "@/lib/storeChat";
import { buildWsUrl } from "@/lib/storeChat";

type Presence = {
    count: number;
    buyer_present: boolean;
    trader_present: boolean;
};

type OfferFlags = {
    offerDirty: boolean;
    offerSent: boolean;
    offerAccepted: boolean;
    offerPaid: boolean;
};

export function useStoreChat(params: {
    buyerId: string;
    traderId: string;
    role: Role;
}) {
    const { buyerId, traderId, role } = params;

    const wsRef = useRef<WebSocket | null>(null);

    const [presence, setPresence] = useState<Presence>({
        count: 0,
        buyer_present: false,
        trader_present: false,
    });

    // ✅ ref for latest presence inside WS callback
    const presenceRef = useRef<Presence>(presence);

    useEffect(() => {
        presenceRef.current = presence;
    }, [presence]);

    const bothInRoom = presence.buyer_present && presence.trader_present;

    const [offerId, setOfferId] = useState<string | null>(null);

    // ✅ ref for latest offerId (avoids stale closure in onopen)
    const offerIdRef = useRef<string | null>(null);

    useEffect(() => {
        offerIdRef.current = offerId;
    }, [offerId]);

    const [offerFlags, setOfferFlags] = useState<OfferFlags>({
        offerDirty: false,
        offerSent: false,
        offerAccepted: false,
        offerPaid: false,
    });

    const [wsMessages, setWsMessages] = useState<ChatMsg[]>([]);
    const [statusText, setStatusText] = useState<string>(
        "Waiting for both participants in room"
    );

    const sendWS = (payload: any) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify(payload));
    };

    const ensureOfferId = async () => {
        if (offerIdRef.current) return offerIdRef.current;

        const res = await fetch("/api/offer/make_offer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                trader_id: traderId,
                buyer_id: buyerId,
            }),
        });

        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        const id = String(data.offer_id || "").trim();
        if (!id) throw new Error("offer_id missing");

        setOfferId(id);
        sendWS({ type: "set_offer", offer_id: id });

        return id;
    };

    useEffect(() => {
        if (!buyerId || !traderId || !role) return;

        const ws = new WebSocket(buildWsUrl(buyerId, traderId, role));
        wsRef.current = ws;

        ws.onopen = async () => {
            console.log("store ws is open");

            if (role === "buyer" && !offerIdRef.current) {
                try {
                    await ensureOfferId();
                } catch (e) {
                    console.error(e);
                }
            }
            console.log("offer_id", offerIdRef.current);
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data) as
                | PresenceMsg
                | ChatMsg;

            // ---- presence
            if (msg.type === "presence") {
                const newPresence: Presence = {
                    count: msg.count ?? 0,
                    buyer_present: !!msg.buyer_present,
                    trader_present: !!msg.trader_present,
                };
                console.log(newPresence);
                setPresence(newPresence);
                presenceRef.current = newPresence;

                if ("offer_id" in msg) {
                    if (msg.offer_id) setOfferId(String(msg.offer_id));
                    else setOfferId(null);
                }
                return;
            }

            // ---- offer flags
            if (
                msg.type === "send_offer" ||
                msg.type === "accept_offer" ||
                msg.type === "pay_offer"
            ) {
                setOfferFlags({
                    offerDirty: !!msg.offer_dirty,
                    offerSent: !!msg.offer_send,
                    offerAccepted: !!msg.offer_accepted,
                    offerPaid: !!msg.offer_paid,
                });
            }

            const bothNow =
                presenceRef.current.buyer_present &&
                presenceRef.current.trader_present;

            if (msg.type === "offer_step") {
                if (!bothNow) {
                    setStatusText(
                        "Waiting for both participants in room"
                    );
                } else if (msg.step === "accept") {
                    setStatusText(
                        role === "buyer"
                            ? "Offer accepted. Now you can pay"
                            : "Waiting for buyer to pay"
                    );
                } else if (msg.step === "connect") {
                    setStatusText(msg.text || "");
                } else if (msg.step === "pay") {
                    setStatusText(msg.text || "Paying…");
                }
            }

            setWsMessages((prev) => [...prev, msg]);
        };

        ws.onclose = () => {
            console.log("store ws CLOSED!");
            wsRef.current = null;
            setOfferId(null);
        };

        return () => {
            ws.close(1000, "unmount");
            wsRef.current = null;
        };
    }, [buyerId, traderId, role]);

    const canSend = bothInRoom;
    const canPay =
        bothInRoom &&
        offerFlags.offerAccepted &&
        !offerFlags.offerPaid;
    const canAccept =
        bothInRoom &&
        offerFlags.offerSent &&
        !offerFlags.offerDirty &&
        !offerFlags.offerAccepted;

    return {
        wsMessages,
        sendWS,
        presence,
        bothInRoom,
        offerId,
        ensureOfferId,
        offerFlags,
        setStatusText,
        statusText,
        canSend,
        canPay,
        canAccept,
        setOfferId,
    };
}
