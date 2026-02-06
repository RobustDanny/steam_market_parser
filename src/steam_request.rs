use serde::de::DeserializeOwned;
use std::{fmt::Debug};

use reqwest;

// type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

use crate::{
    MarketRequest, 
    MostRecentItemsRequest,
    // TradeOfferRequest,
};

pub trait SteamRequest{}

pub trait ProcessSteamRequest{

    async fn process_request<T: SteamRequest + Debug + DeserializeOwned>(url: String) -> Result<T, Box<dyn std::error::Error + Send + Sync>>{
        // println!("{url}");
        let json_response = send_request(url).await?;

        // println!("{:#?}", json_response);

        Ok(json_response)
    }

    fn custom_market_url(request: MarketRequest) -> String {

        let url = format!("https://steamcommunity.com/market/search/render/
        ?appid={}&start={}&query={}&sort={}&sort_dir={}&search_descriptions={}&price_min={}&price_max={}&norender=1",
        request.game, request.page, request.query, request.sort, request.sort_dir, request.search_descriptions, request.price_min, request.price_max);
        // println!("{url}");
        url
    }

    fn most_recent_items_url(request: MostRecentItemsRequest) -> String{

        let url = format!("https://steamcommunity.com/market/recent?country={}&language={}&currency={}&norender=1", 
        request.country, request.language, request.currency);
        url
    }

    // fn url_send_trade_offer(request: TradeOfferRequest) -> String{

    //     let url = format!("https://steamcommunity.com/tradeoffer/new/?partner={}&token={}",
    //     request.partner_steam_id, request.partner_trade_token);
    //     url
    // }
}

async fn send_request<T: SteamRequest + DeserializeOwned>(url: String) -> Result<T, Box<dyn std::error::Error + Send + Sync>>{
    // type SteamResponse: for<'de> Deserialize<'de>;
        
        let client = reqwest::Client::new();

        let respond = client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await?
            .text()
            .await?;

        let respond = serde_json::from_str(&respond)?;
        Ok(respond)
}
