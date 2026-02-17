// Rust structs mirrored to TS (minimum fields you use)
export type MostRecent = {
    id: number;                 // usize -> number
    listinginfo_id: string;
    name: string;
    converted_price: string;    // IMPORTANT: Rust sends string
    appid: string;
    game: string;
    market_hash_name: string;
    tradable: string;           // "1" or "0"
    icon: string;
    game_icon: string;
};

export type UserProfileAds = {
    steamid: string;
    nickname: string;
    avatar: string;
    first_item_image: string;
    second_item_image: string;
    third_item_image: string;
    fourth_item_image: string;
};

// What you render in grid:
export type FeedCard =
    | { kind: "item"; data: MostRecent }
    | { kind: "ad"; data: UserProfileAds };
