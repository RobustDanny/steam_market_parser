use actix_session::{Session};
use actix_web::{HttpResponse, HttpRequest, Responder, web, Result};
use tera::{Context};
// use uuid::Uuid;
use serde_json::json;
use regex::Regex;
use std::collections::{HashMap, HashSet};


use crate::{
    AppState, 
    UserAdState, 
    FeedItemsState, 
    UserInventoryState,
    StoreHashMapState,
    StoreWebsocketListState,
    GameListState
};
use steam_market_parser::{
    AdCardHistoryVec, 
    AppContext, 
    BuyerAndStoreIDS, 
    CardAppearingFilter, 
    CurrentStatusOffer, 
    DraftItem, 
    FilterInput, 
    HistoryForm, 
    Inventory, 
    InventoryApp, 
    InventoryGame, 
    LoadGameInventory, 
    MostRecentItemsFilter, 
    OfferCheckResult, 
    OfferContent, 
    OfferContentToCheck, 
    OfferContentUpdated, 
    OfferMakingPlayload, 
    ProfileTradeUrl, 
    SteamUser, 
    StoreID, 
    TradeOfferRequest, 
    UserProfileAds
};

use crate::db::DataBase;

pub async fn load_inventory(_user_inventory: web::Data<UserInventoryState>, params: web::Form<InventoryApp>)-> impl Responder{

    let inventory = &*params;

    if inventory.settings_steamid.trim().is_empty() {
        return HttpResponse::BadRequest().body("steamid is required");
    }

    let context = match inventory.settings_appid.as_str() {
        "753" => "6".to_string(),
        _ => "2".to_string(),
    };

    let url = format!("https://steamcommunity.com/inventory/{}/{}/{}", inventory.settings_steamid, inventory.settings_appid, context);   

    println!("{url}");
    
    let client = reqwest::Client::new();

        let respond = client
            .get(url)
            .header("Accept", "application/json")
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();

        // println!("{respond:#?}");

        if respond.trim() == "null" {
            return HttpResponse::Ok().json(Inventory {
                assets: vec![],
                descriptions: vec![],
                asset_properties: vec![],
                total_inventory_count: Some(0),
                success: Some(0),
                rwgrsn: Some(0),
            });
        }        

        let mut respond: Inventory = match serde_json::from_str(&respond) {
            Ok(inv) => inv,
            Err(e) => {
                eprintln!("Steam inventory parse error: {e}");
                return HttpResponse::BadGateway().body("Invalid inventory response from Steam");
            }
        };
        
        respond = keep_only_tradable(respond);
        
        HttpResponse::Ok().json(&respond)
        
}

fn keep_only_tradable(mut inv: Inventory) -> Inventory {
    // 1) collect all (classid, instanceid) pairs that are tradable == 1
    let tradable_keys: HashSet<(String, String)> = inv
        .descriptions
        .iter()
        .filter(|d| d.tradable == Some(1))
        .filter_map(|d| {
            Some((
                d.classid.clone()?,     // Option<String>
                d.instanceid.clone()?,  // Option<String>
            ))
        })
        .collect();

    // 2) filter descriptions down to tradable ones (optional but usually desired)
    inv.descriptions = inv
        .descriptions
        .into_iter()
        .filter(|d| d.tradable == Some(1))
        .collect();

    // 3) filter assets to only those whose (classid, instanceid) is tradable
    inv.assets = inv
        .assets
        .into_iter()
        .filter(|a| {
            match (&a.classid, &a.instanceid) {
                (Some(c), Some(i)) => tradable_keys.contains(&(c.clone(), i.clone())),
                _ => false,
            }
        })
        .collect();

    // asset_properties: you can keep as-is, or filter by matching assetid/contextid if you want.
    inv.total_inventory_count = Some(inv.assets.len() as u32);

    inv
}

///add error handle
pub async fn steam_logout(session: Session) -> impl Responder {

    let steam_user: Option<SteamUser> = session.get("steam_user").unwrap_or(None);
    if let Some(steamid) = steam_user {
        let db = DataBase::connect_to_db();
        db.db_change_user_status(steamid);
        drop(db);
    }
    session.clear();
    
    HttpResponse::Found()
        .append_header(("Location", "/"))
        .finish()
}

pub async fn add_ad_steam_user_to_db(form: web::Form<UserProfileAds>, state: web::Data<UserAdState>) -> impl Responder {
    
    let ad_user: UserProfileAds = form.into_inner();

    let db = DataBase::connect_to_db();
    db.db_add_ad_steam_user(&ad_user);

    state.user_ads.lock().await.queue.push_back(ad_user.clone());

    drop(db);
    HttpResponse::Ok().json(&ad_user)
}

pub async fn post_most_recent_item_filters(params: web::Query<FilterInput>,
    session: Session)-> impl Responder{

        let deref_param = &*params;
        println!("{deref_param:#?}");
        let deref_item_filters = MostRecentItemsFilter{
            appid: deref_param.appid.clone(),
            price_min: deref_param.price_min.clone(),
            price_max: deref_param.price_max.clone(),
            query: deref_param.query.clone(),
        };

        let deref_card_filters = CardAppearingFilter{
            card_appearing: deref_param.card_appearing.clone()
        };

        session.insert("item_filters", deref_item_filters).unwrap();
        session.insert("card_filters", deref_card_filters).unwrap();
        
        HttpResponse::Ok().json(&*params)
}

pub async fn get_ad_cards_history(form: web::Form<HistoryForm>) -> impl Responder {
    let db = DataBase::connect_to_db();

    let deref_form = &*form;

    match db.db_get_ad_cards_history(deref_form.steamid.clone()) {
        Ok(result) => HttpResponse::Ok().json(&result),
        Err(e) => {
            println!("Database error: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}

pub async fn add_to_store_queue(state: web::Data<StoreHashMapState>, buyer_and_store_steamid: web::Json<BuyerAndStoreIDS>)->impl Responder{

    let store = &*buyer_and_store_steamid.trader_id;
    let buyer = &*buyer_and_store_steamid.buyer_id;

    if store == buyer {
        println!("You can't add yourself to the queue!");
    }

    let buyer = buyer.to_string();

    let mut hashmap = state.store_hashmap_state.hashmap.get(store).unwrap().lock().await;

    if hashmap.contains(&buyer){
        println!("Buyer {} is already in this store queue!", buyer);
    } else {
        hashmap.push_back(buyer);
    }

    let check = &state.store_hashmap_state;
    
    drop(hashmap);

    println!("{check:?}");

    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Buyer added to queue"
    }))
}

pub async fn remove_from_store_queue(state: web::Data<StoreHashMapState>, store_steamid: web::Json<StoreID>, websocket_list_state: web::Data<StoreWebsocketListState>)->impl Responder{

    let store_id = &*store_steamid.trader_id;

    let mut hashmap = state.store_hashmap_state.hashmap.get(store_id).unwrap().lock().await;

    let buyer_id = hashmap.pop_front().expect("Store queue is empty");

    drop(hashmap);
    
    HttpResponse::Ok().json(serde_json::json!({
        "buyer_id": buyer_id
    }))
}

pub async fn get_inventory_games(params: web::Json<LoadGameInventory>) -> Result<HttpResponse> {
    let steamid = params.store_steamid.trim();
    if steamid.is_empty() {
        return Ok(HttpResponse::BadRequest().body("steamid is required"));
    }

    let url = format!("https://steamcommunity.com/profiles/{}/inventory/", steamid);

    let client = reqwest::Client::builder()
        .gzip(true)
        .build()
        .unwrap();


        let respond = client
            .get(url)
            .header("Accept", "application/json")
            .header("User-Agent", "Mozilla/5.0")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();

    // (?s) enables "dot matches newline" so .*? spans across lines
    let re = Regex::new(r#"(?s)var\s+g_rgAppContextData\s*=\s*(\{.*?\});"#)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let caps = re
        .captures(&respond)
        .ok_or_else(|| actix_web::error::ErrorBadGateway("g_rgAppContextData not found"))?;

    let json_str = &caps[1];

    let data: HashMap<String, AppContext> = serde_json::from_str(json_str)
        .map_err(actix_web::error::ErrorBadGateway)?;

    // Convert into a clean response list
    let games: Vec<InventoryGame> = data
        .into_iter()
        .map(|(_k, app)| InventoryGame {
            appid: app.appid,
            name: app.name,
            items: app.asset_count,
        })
        .collect();

    // games.sort_by_key(|g| g.appid);

    println!("{games:#?}");

    Ok(HttpResponse::Ok().json(games))
}

pub async fn store_rating(session: Session, state: web::Data<AppState>) -> impl Responder {
    
    let steam_user: Option<SteamUser> = session.get("steam_user").unwrap_or(None);

    // println!("steam_user: {steam_user:#?}");
    
    let mut ctx = Context::new();

    ctx.insert("steam_user", &steam_user);

    state
        .tera
        .render("store_list.html", &ctx)
        .map(|body| HttpResponse::Ok().content_type("text/html").body(body))
        .map_err(|e| {
            println!("Tera render error: {:?}", e);
            actix_web::error::ErrorInternalServerError("Template error")
        })
}

pub async fn offer_make_offer(ids: web::Json<BuyerAndStoreIDS>) -> OfferMakingPlayload{
     
    let db = DataBase::connect_to_db();

    // Consume the JSON payload to move out the owned strings
    let BuyerAndStoreIDS { buyer_id, trader_id } = ids.into_inner();

    let offer_id = db.db_offer_make_offer(buyer_id, trader_id);

    drop(db);
    // println!("offer_id: {offer_id}");
    
    let playload  = OfferMakingPlayload {
        offer_id
    };
    playload
}

pub async fn offer_update_offer(offer_content: web::Json<OfferContent>) -> OfferContentUpdated{
    
    let db = DataBase::connect_to_db();

    // Consume the JSON payload to move out the owned strings
    let OfferContent { offer_id, special_for_update_offer} = offer_content.into_inner();

    let result = db.db_offer_update_offer(offer_id, special_for_update_offer);

    drop(db);
    
    result
}

pub async fn offer_update_status_offer(current_status: web::Json<CurrentStatusOffer>)-> impl Responder{

    let status_and_offer_id  = CurrentStatusOffer {
        offer_id: current_status.offer_id.clone(),
        status: current_status.status.clone()
    };

    let db = DataBase::connect_to_db();

    db.db_offer_update_status_offer(status_and_offer_id);

    drop(db);

    HttpResponse::Ok()
}

pub async fn offer_check_offer_to_pay(sent_offer: web::Json<OfferContentToCheck>) -> impl Responder {
    let status_and_offer_id  = OfferContentToCheck {
        offer_id: sent_offer.offer_id.clone(),
        special_for_save_offer: sent_offer.special_for_save_offer.clone(),
        partner_steam_id: sent_offer.partner_steam_id.clone(),
    };

    let mut db = DataBase::connect_to_db();
    let result: OfferCheckResult = db.db_offer_check_offer_to_pay(status_and_offer_id);

    if !result.check_result {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "offer_id": result.offer_id,
            "error": "validation_failed"
        }));
    }

    // Map result.offer_items -> DraftItem
    // IMPORTANT: update field name to your real assetid field
    let give: Vec<DraftItem> = result.offer_items.iter().map(|it| DraftItem {
        appid: it.item_appid.parse::<u32>().unwrap(),
        contextid: it.item_contextid.to_string(),
        assetid: it.item_asset_id.to_string(), // <-- rename if needed
        amount: 1,
    }).collect();

    let draft_id = match db.db_create_offer_draft(
        &result.offer_id,
        &result.partner_trade_url,
        false,
        give,
    ) {
        Ok(id) => id,
        Err(e) => {
            drop(db);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false,
                "error": format!("db_create_offer_draft_failed: {e}")
            }));
        }
    };

    drop(db);

    // Append draft_id to the steam trade URL
    let steam_url = format!("{}&tastyrock={}", result.partner_trade_url, draft_id);
    println!("stream_url: {}", steam_url);
    HttpResponse::Ok().json(serde_json::json!({
        "ok": true,
        "offer_id": result.offer_id,
        "draft_id": draft_id,
        "steam_url": steam_url
    }))
}


pub async fn account_post_trade_url(profile_trade_url: web::Json<ProfileTradeUrl>)->impl Responder{

    let steam_id = &profile_trade_url.steam_id;
    let trade_url = &profile_trade_url.trade_url;

    let db = DataBase::connect_to_db();

    db.db_account_post_trade_url(steam_id, trade_url);

    drop(db);

    HttpResponse::Ok()
}

pub async fn account_reset_trade_url(profile_trade_url: web::Json<ProfileTradeUrl>)->impl Responder{

    let steam_id = &profile_trade_url.steam_id;

    let db = DataBase::connect_to_db();

    db.db_account_reset_trade_url(steam_id);

    drop(db);

    HttpResponse::Ok()
}

pub async fn offer_get_draft(path: web::Path<String>) -> HttpResponse {
    let draft_id = path.into_inner();
    println!("offer_get_draft: {draft_id}");

    let db = DataBase::connect_to_db();

    match db.db_get_offer_draft(&draft_id) {
        Ok(draft) => {
            drop(db);
            HttpResponse::Ok().json(draft)
        }
        Err(_) => {
            drop(db);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "draft_not_found",
                "draft_id": draft_id
            }))
        }
    }
}

pub async fn api_me(session: Session) -> impl Responder {
    let steam_user: Option<SteamUser> = session.get("steam_user").unwrap_or(None);
    HttpResponse::Ok().json(serde_json::json!({
        "steam_user": steam_user
    }))
}

pub async fn tera_update_data(session: Session, 
    state: web::Data<AppState>, 
    feed_state: web::Data<FeedItemsState>, 
    _user_inventory: web::Data<UserInventoryState>,
    game_list: web::Data<GameListState>) -> impl Responder {
    let items = feed_state.items.lock().await.clone();
    let game_list_vec = game_list.game_list.lock().await.clone();
    let filters: FilterInput = match session.get("filters") {
        Ok(Some(f)) => f,
        _ => FilterInput {
            appid: "Steam".into(),
            price_min: "0".into(),
            price_max: "999999".into(),
            query: "".into(),
            card_appearing: "stores_items".into(),
        },
    };
    
    let steam_user: Option<SteamUser> = session.get("steam_user").unwrap_or(None);

    let vec_ad_cards_history = AdCardHistoryVec{
        ad_card_vec: Vec::new(),
    };
    
    println!("filters: {filters:#?}");
    println!("steam_user: {steam_user:#?}");
    
    let mut ctx = Context::new();
    // ctx.insert("user_inventory", &inventory);
    ctx.insert("most_recent_items", &items);
    ctx.insert("filters", &filters);
    ctx.insert("steam_user", &steam_user);
    ctx.insert("vec_ad_cards_history", &vec_ad_cards_history);
    ctx.insert("game_list", &game_list_vec);

    state
        .tera
        .render("main_page.html", &ctx)
        .map(|body| HttpResponse::Ok().content_type("text/html").body(body))
        .map_err(|e| {
            println!("Tera render error: {:?}", e);
            actix_web::error::ErrorInternalServerError("Template error")
        })
}
