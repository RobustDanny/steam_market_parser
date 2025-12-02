use std::collections::VecDeque;
use std::time::Duration;
use steam_market_parser::{MostRecentItemsFilter, CustomItems, MostRecentItems, 
    Sort, SortDirection, SteamMostRecentResponse, MostRecent, FilterInput,
    UserAdsQueue, UserProfileAds, SteamUser, Inventory, InventoryApp};
use actix_web::{App, HttpResponse, HttpServer, Responder, web, cookie::Key};
use actix_files::Files;
use actix_session::{Session, SessionMiddleware, storage::CookieSessionStore};
use tera::{Context, Tera};
use tokio::sync::{mpsc, Mutex, broadcast};
use serde::{Deserialize, Serialize};

mod db;
use db::DataBase;

mod websocket;
use websocket::{ws_handler, ws_ad_handler, BroadcastPayload, AdsBroadcastPayload};

mod steam_login;
use steam_login::{steam_login, steam_return};

struct AppState {
    tera: Tera,
    items: Mutex<Vec<MostRecent>>,
    user_ads: Mutex<UserAdsQueue>,
    ads_broadcaster: broadcast::Sender<AdsBroadcastPayload>,
    broadcaster: broadcast::Sender<BroadcastPayload>,
}

#[derive(Debug)]
pub struct UserInventory{
    inventory: Mutex<Inventory>,
}

//Best time
    //thread::sleep(Duration::from_millis(1000));

#[actix_web::main]
async fn main()-> std::io::Result<()> {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    let secret_key = std::env::var("SESSION_SECRET_KEY")
        .expect("SESSION_SECRET_KEY must be set in .env file");
    
    let key = Key::from(secret_key.as_bytes());

    let db = DataBase::connect_to_db();

    let country = Some("US".to_string());
    let language = Some("english".to_string());
    let currency = Some("3".to_string());

    let (request_sender, response_receiver) = mpsc::channel(100);
    let (broadcast_sender_most_recent_items, _broadcast_reciever_most_recent_items) = broadcast::channel(32);
    let (broadcast_sender_user_ad, _broadcast_reciever_user_ad) = broadcast::channel(10);

    // let count = None;
    // let page = None;
    // let game = Some(730);
    // let sort = Some(Sort::Price);
    // let search_descriptions = None;
    // let price_min = Some(50);
    // let price_max = Some(100);
    // let sort_dir = Some(SortDirection::Asc);
    // let query = None; 

    

    //-------------------
    // let items_result = match CustomItems::get_items_query(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max).await {
    //     Ok(items) => {
    //         // let mut shared = shared_items.write().await;
    //         // *shared = items.vec;
    //         println!("Initial items loaded: {items:#?} items");
    //     }
    //     Err(e) => {
    //         eprintln!("Error fetching initial items: {e}");
    //     }
    // };
    //-------------------
        
        let user_inventory = web::Data::new(UserInventory{
            inventory: Mutex::new(Inventory{
                assets: Vec::new(),
                descriptions: Vec::new(),
                asset_properties: Vec::new(),
                total_inventory_count: Some(0),
                success: Some(0),
                rwgrsn: Some(0),
            }),
        });

        let state = web::Data::new(AppState {
            tera: Tera::new("front/**/*").expect("Tera init failed"),
            items: Mutex::new(Vec::new()),
            ads_broadcaster: broadcast_sender_user_ad,
            broadcaster: broadcast_sender_most_recent_items,
            user_ads: Mutex::new(UserAdsQueue { 
                queue: db.db_get_ad_steam_user(),
            })
        });

        let state_for_ws = state.clone();
        let state_for_ads = state.clone();

        tokio::spawn(async move {
            tokio_receiver_most_recent_items_request(response_receiver, db, state_for_ws).await;
        });

        tokio::spawn(async move {
            tokio_user_ad_loop(state_for_ads).await; 
        });

        let _ = MostRecentItems::get_most_recent_items(country, language, currency, request_sender).await;
        
        //----------------------------------
        //----------------------------------
        //Server Actix
        HttpServer::new(move || {

            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
                .app_data(state.clone())
                .app_data(user_inventory.clone())
                .service(Files::new("/front", "./front"))
                .route("/", web::get().to(tera_update_data))
                .route("/ws", web::get().to(ws_handler)) 
                .route("/ws/ads", web::get().to(ws_ad_handler)) 
                .route("/api/logout", web::get().to(steam_logout)) 
                .route("/api/get_inventory_items", web::post().to(settings_load_inventory)) 
                .route("/api/filters", web::get().to(post_most_recent_item_filters))
                .route("/api/add_to_ad_queue", web::post().to(add_ad_steam_user_to_db))
                .route("/api/auth/steam", web::get().to(steam_login))
                .route("/api/auth/steam/return", web::get().to(steam_return))
        })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
        //----------------------------------
        //----------------------------------
}

pub async fn settings_load_inventory(user_inventory: web::Data<UserInventory>, params: web::Form<InventoryApp>)-> impl Responder{

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

        // *user_inventory.inventory.lock().await = &respond;

    HttpResponse::Ok().json(&respond)
}

pub async fn steam_logout(session: Session) -> impl Responder {

    session.clear();

    HttpResponse::Found()
        .append_header(("Location", "/"))
        .finish()
}

async fn add_ad_steam_user_to_db(form: web::Form<UserProfileAds>, state: web::Data<AppState>) -> impl Responder {
    
    let ad_user: UserProfileAds = form.into_inner();

    let db = DataBase::connect_to_db();
    db.db_add_ad_steam_user(&ad_user);

    state.user_ads.lock().await.queue.push_back(ad_user.clone());

    drop(db);
    HttpResponse::Ok().json(&ad_user)
}

async fn post_most_recent_item_filters(params: web::Query<FilterInput>,
    session: Session)-> impl Responder{

        session.insert("filters", &*params).unwrap();
    
        HttpResponse::Ok().json(&*params)
}

async fn tokio_user_ad_loop(state: web::Data<AppState>){
    loop {
        let mut ads = state.user_ads.lock().await;

        if let Some(pop) = ads.queue.pop_front() {
            ads.queue.push_back(pop);
        }
        
        let playload = AdsBroadcastPayload{
            user_ads: ads.queue.clone(),
        };

        let _ = state.ads_broadcaster.send(playload);

        drop(ads);
        tokio::time::sleep(Duration::from_secs(10)).await;
    }
}

async fn tokio_receiver_most_recent_items_request(
    mut receiver: mpsc::Receiver<SteamMostRecentResponse>,
    db: DataBase,
    state: web::Data<AppState>,
) {
    while let Some(most_recent_items_response) = receiver.recv().await {
        let (start_id, end_id) = db.db_post_most_recent_items(most_recent_items_response);

        if let Ok(result) = db.db_get_most_recent_items(start_id, end_id) {
            {
                let mut items = state.items.lock().await;
                *items = result.clone();
            }
            let payload = BroadcastPayload {
                items: result.clone(),
            };
            let _ = state.broadcaster.send(payload);
        }
    }
}

async fn tera_update_data(session: Session, state: web::Data<AppState>, user_inventory: web::Data<UserInventory>) -> impl Responder {
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

    let inventory = user_inventory.inventory.lock().await;
    let inventory = (*inventory).clone();
    
    let mut ctx = Context::new();
    ctx.insert("user_inventory", &inventory);
    ctx.insert("most_recent_items", &items);
    ctx.insert("filters", &filters);
    ctx.insert("steam_user", &steam_user);

    state
        .tera
        .render("main.html", &ctx)
        .map(|body| HttpResponse::Ok().content_type("text/html").body(body))
        .map_err(|e| {
            println!("Tera render error: {:?}", e);
            actix_web::error::ErrorInternalServerError("Template error")
        })
}