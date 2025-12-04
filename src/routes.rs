use actix_session::{Session};
use actix_web::{HttpResponse, Responder, web};
use tera::{Context};

use crate::{AppState, UserInventoryState};
use steam_market_parser::{InventoryApp, UserProfileAds, Inventory, FilterInput, SteamUser};

use crate::db::DataBase;

pub async fn settings_load_inventory(_user_inventory: web::Data<UserInventoryState>, params: web::Form<InventoryApp>)-> impl Responder{

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

pub async fn steam_logout(session: Session) -> impl Responder {

    session.clear();

    HttpResponse::Found()
        .append_header(("Location", "/"))
        .finish()
}

pub async fn add_ad_steam_user_to_db(form: web::Form<UserProfileAds>, state: web::Data<AppState>) -> impl Responder {
    
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

pub async fn tera_update_data(session: Session, state: web::Data<AppState>, _user_inventory: web::Data<UserInventoryState>) -> impl Responder {
    let items = state.items.lock().await.clone();
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
    
    println!("filters: {filters:#?}");
    println!("steam_user: {steam_user:#?}");

    // let inventory = user_inventory.inventory.lock().await;
    // let inventory = (*inventory).clone();
    
    let mut ctx = Context::new();
    // ctx.insert("user_inventory", &inventory);
    ctx.insert("most_recent_items", &items);
    ctx.insert("filters", &filters);
    ctx.insert("steam_user", &steam_user);

    state
        .tera
        .render("main_page.html", &ctx)
        .map(|body| HttpResponse::Ok().content_type("text/html").body(body))
        .map_err(|e| {
            println!("Tera render error: {:?}", e);
            actix_web::error::ErrorInternalServerError("Template error")
        })
}