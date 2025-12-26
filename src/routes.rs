use actix_session::{Session};
use actix_web::{HttpResponse, Responder, web};
use tera::{Context};
use serde_json::json;

use crate::{
    AppState, 
    UserAdState, 
    FeedItemsState, 
    UserInventoryState,
    StoreHashMapState,
};
use steam_market_parser::{
    InventoryApp, 
    UserProfileAds, 
    Inventory, 
    FilterInput, 
    SteamUser,
    HistoryForm,
    AdCardHistoryVec,
    BuyerAndStoreIDS,
    StoreID
};

use crate::db::DataBase;

pub async fn load_inventory(_user_inventory: web::Data<UserInventoryState>, params: web::Form<InventoryApp>)-> impl Responder{

    let inventory = &*params;

    let url = format!("https://steamcommunity.com/inventory/{}/{}/2", inventory.settings_steamid, inventory.settings_appid);   

    println!("{url}");
    let client = reqwest::Client::new();

        let respond = client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();

        let respond: Inventory = serde_json::from_str(&respond).unwrap();

        // *user_inventory.inventory.lock().await = respond;

    HttpResponse::Ok().json(&respond)
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

        session.insert("filters", &*params).unwrap();
    
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

    let store = &*buyer_and_store_steamid.store_id;
    let buyer = &*buyer_and_store_steamid.buyer_id;

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

pub async fn remove_from_store_queue(state: web::Data<StoreHashMapState>, store_steamid: web::Json<StoreID>)->impl Responder{

    let store = &*store_steamid.store_id;

    let mut hashmap = state.store_hashmap_state.hashmap.get(store).unwrap().lock().await;

    let buyer_id = hashmap.pop_back().expect("Store queue is empty");

    let check = &state.store_hashmap_state;
    
    drop(hashmap);

    println!("Buyer id from queue: {buyer_id}");
    println!("{check:?}");
    
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Buyer removed from queue"
    }))
}

pub async fn tera_update_data(session: Session, state: web::Data<AppState>, feed_state: web::Data<FeedItemsState>, _user_inventory: web::Data<UserInventoryState>) -> impl Responder {
    let items = feed_state.items.lock().await.clone();
    let filters: FilterInput = match session.get("filters") {
        Ok(Some(f)) => f,
        _ => FilterInput {
            appid: "Steam".into(),
            price_min: "0".into(),
            price_max: "999999".into(),
            query: "".into(),
        },
    };
    
    let steam_user: Option<SteamUser> = session.get("steam_user").unwrap_or(None);

    let vec_ad_cards_history = AdCardHistoryVec{
        ad_card_vec: Vec::new(),
    };
    
    println!("filters: {filters:#?}");
    println!("steam_user: {steam_user:#?}");

    // let inventory = user_inventory.inventory.lock().await;
    // let inventory = (*inventory).clone();
    
    let mut ctx = Context::new();
    // ctx.insert("user_inventory", &inventory);
    ctx.insert("most_recent_items", &items);
    ctx.insert("filters", &filters);
    ctx.insert("steam_user", &steam_user);
    ctx.insert("vec_ad_cards_history", &vec_ad_cards_history);

    state
        .tera
        .render("main_page.html", &ctx)
        .map(|body| HttpResponse::Ok().content_type("text/html").body(body))
        .map_err(|e| {
            println!("Tera render error: {:?}", e);
            actix_web::error::ErrorInternalServerError("Template error")
        })
}