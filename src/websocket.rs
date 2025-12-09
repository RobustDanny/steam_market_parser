use std::collections::VecDeque;

use actix_web_actors::ws;
use actix_web::{Error, HttpRequest, Result, HttpResponse, web};
use actix::prelude::*;
use actix_session::Session;
use steam_market_parser::UserProfileAds;

use crate::{
    UserAdState, 
    FeedItemsState, 
    MostRecent, 
    MostRecentItemsFilter
};

#[derive(serde::Serialize, Clone)]
pub struct BroadcastPayload {
    pub items: Vec<MostRecent>,
}

#[derive(serde::Serialize, Clone)]
pub struct AdsBroadcastPayload {
    pub user_ads: VecDeque<UserProfileAds>,
}

struct WsActor {
    state: web::Data<FeedItemsState>,
    user_filters: MostRecentItemsFilter,
}

struct AdWSActor {
    state: web::Data<UserAdState>,
}

impl Actor for AdWSActor {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to broadcast channel and forward updates via actor messages
        let mut rx = self.state.ads_broadcaster.subscribe();
        let addr = ctx.address();

        tokio::spawn(async move {
            while let Ok(payload) = rx.recv().await {
                let _ = addr.do_send(BroadcastAds(payload));
            }
        });
    }
}

impl Actor for WsActor {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to broadcast channel and forward updates via actor messages
        let mut rx = self.state.broadcaster.subscribe();
        let addr = ctx.address();

        tokio::spawn(async move {
            while let Ok(payload) = rx.recv().await {
                let _ = addr.do_send(BroadcastItems(payload));
            }
        });
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for AdWSActor {
    fn handle(&mut self, _msg: Result<ws::Message, ws::ProtocolError>, _ctx: &mut Self::Context) {
        //Put a handler here
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsActor {
    fn handle(&mut self, _msg: Result<ws::Message, ws::ProtocolError>, _ctx: &mut Self::Context) {
        if let Ok(ws::Message::Text(text)) = _msg {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                if v["type"] == "filters" {
                    self.user_filters = MostRecentItemsFilter {
                        appid: v["appid"].as_str().unwrap_or("Steam").into(),
                        price_min: v["price_min"].as_str().unwrap_or("0").into(),
                        price_max: v["price_max"].as_str().unwrap_or("999999").into(),
                        query: v["query"].as_str().unwrap_or("").into(),
                    };
                    println!("WS FILTERS UPDATED → {:?}", self.user_filters);
                }
            }
        }
    }
}

struct BroadcastItems(BroadcastPayload);
struct BroadcastAds(AdsBroadcastPayload);

impl Message for BroadcastItems {
    type Result = ();
}

impl Message for BroadcastAds {
    type Result = ();
}

#[derive(serde::Serialize)]
struct WsResponse {
    items: Vec<MostRecent>,
}

#[derive(serde::Serialize)]
struct WsAdResponse {
    user_ads: VecDeque<UserProfileAds>,
}

impl Handler<BroadcastAds> for AdWSActor {
    type Result = ();

    fn handle(&mut self, msg: BroadcastAds, ctx: &mut Self::Context) {
        // apply per-user filters
        let user_ads = msg.0.user_ads;
    
        let response = WsAdResponse {
            user_ads
        };
        // println!("Broadcast → sending {} items", response.items.len());

        if let Ok(json) = serde_json::to_string(&response) {
            ctx.text(json);
        }
    }
}

impl Handler<BroadcastItems> for WsActor {
    type Result = ();

    ///add filter by the game!!!
    fn handle(&mut self, msg: BroadcastItems, ctx: &mut Self::Context) {
        // apply per-user filters
        let filtered_items: Vec<MostRecent> = msg.0.items
            .iter()
            .filter(|item| {
                let converted_price = item.converted_price.parse::<f64>().unwrap_or(0.0);
                let p_min = self.user_filters.price_min.parse::<f64>().unwrap_or(0.0);
                let p_max = self.user_filters.price_max.parse::<f64>().unwrap_or(f64::MAX);
                //add filter by the game!!!
                converted_price >= p_min &&
                converted_price <= p_max &&
                item.name.to_lowercase().contains(&self.user_filters.query.to_lowercase())
            })
            .cloned()
            .collect();
    
        let response = WsResponse {
            items: filtered_items,
        };
        // println!("Broadcast → sending {} items", response.items.len());

        if let Ok(json) = serde_json::to_string(&response) {
            ctx.text(json);
        }
    }
}

pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    session: Session,
    state: web::Data<FeedItemsState>,
) -> Result<HttpResponse, Error> {
    let filters: Option<MostRecentItemsFilter> = session.get("filters")?;
    let filters = filters.unwrap_or_else(|| MostRecentItemsFilter {
        appid: "Steam".into(),
        price_min: "0".into(),
        price_max: "99999".into(),
        query: "".into(),
    });

    let ws = WsActor {
        state: state.clone(),
        user_filters: filters,
    };

    ws::start(ws, &req, stream)
}

pub async fn ws_ad_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<UserAdState>,
) -> Result<HttpResponse, Error> {

    let ws_ad = AdWSActor {
        state: state.clone(),
    };
    
    ws::start(ws_ad, &req, stream)
}