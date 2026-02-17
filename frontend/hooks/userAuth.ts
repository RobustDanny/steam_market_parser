"use client";
import { useEffect, useState } from "react";

export type SteamUser = {
    steamid: string;
    nickname: string;
    avatar_url_small: string;
    avatar_url_full: string;
    status: string;
};

export function useMe() {
    const [steamUser, setSteamUser] = useState<SteamUser | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        fetch("/api/me", { credentials: "include", cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => setSteamUser(data?.steam_user ?? null))
            .finally(() => setLoaded(true));
    }, []);

    return { steamUser, loaded };
}