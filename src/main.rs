use std::collections::HashMap;

use actix::Actor;
use actix_web::{App, HttpServer, web, cookie::Key};
use actix_files::Files;
use actix_session::{SessionMiddleware, storage::CookieSessionStore};
use tera::{Tera};
use tokio::sync::{mpsc, Mutex, broadcast};

use steam_market_parser::{
    MostRecentItemsFilter,
    MostRecentItems, 
    SteamMostRecentResponse, 
    MostRecent,
    UserAdsQueue, 
    Inventory,
    StoreQueueHashmap,
    ChatSessionPlayload
};

mod db;
use db::DataBase;

mod websocket;
use websocket::{
    ws_handler, 
    ws_ad_handler, 
    BroadcastPayload, 
    AdsBroadcastPayload
};

mod steam_login;
use steam_login::{
    steam_login, 
    steam_return
};

mod routes;
use routes::{
    tera_update_data, 
    store_rating,
    steam_logout, 
    load_inventory, 
    post_most_recent_item_filters, 
    add_ad_steam_user_to_db,
    get_ad_cards_history,
    add_to_store_queue,
    remove_from_store_queue,
    get_inventory_games,
    offer_make_offer,
    offer_update_offer,
    offer_update_status_offer,
    offer_check_offer_to_pay
};

mod background_tasks;
use background_tasks::{
    tokio_user_ad_loop,
    tokio_receiver_most_recent_items_request,
};

mod store_chat_websocket;
use store_chat_websocket::{
    ws_chat_handler,
    ChatHub
};

struct AppState {
    tera: Tera,
}

struct FeedItemsState{
    items: Mutex<Vec<MostRecent>>,
    broadcaster: broadcast::Sender<BroadcastPayload>,
}

struct UserAdState{
    user_ads: Mutex<UserAdsQueue>,
    ads_broadcaster: broadcast::Sender<AdsBroadcastPayload>,
}
struct UserInventoryState{
    inventory: Mutex<Inventory>,
}

struct StoreHashMapState{
    store_hashmap_state: StoreQueueHashmap,
}

struct StoreWebsocketListState{
    websocket_list: Mutex<HashMap<String, ChatSessionPlayload>>,
}

#[actix_web::main]
async fn main()-> std::io::Result<()> {

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

    let empty_store_hashmap: StoreQueueHashmap = StoreQueueHashmap::new();
    let filled_store_hashmap = db.db_fill_store_hashmap(empty_store_hashmap).unwrap();

    let chat_hub = ChatHub::new().start();
    let chat_hub = web::Data::new(chat_hub);

    println!("{filled_store_hashmap:#?}");

    let store_hashmap = web::Data::new(StoreHashMapState{
        store_hashmap_state: filled_store_hashmap,
    });

    let user_inventory = web::Data::new(UserInventoryState{
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
    });

    let feed_state = web::Data::new(FeedItemsState{
        items: Mutex::new(Vec::new()),
        broadcaster: broadcast_sender_most_recent_items,
    });

    let user_ad_state = web::Data::new(UserAdState{
        ads_broadcaster: broadcast_sender_user_ad,
        user_ads: Mutex::new(UserAdsQueue { 
            queue: db.db_get_ad_steam_user(),
        })
    });

    let websocket_list_state = web::Data::new(StoreWebsocketListState{
        websocket_list: Mutex::new(HashMap::new()),
    });

    let user_ad_state_for_ads = user_ad_state.clone();
    let feed_state_for_ws = feed_state.clone();

    tokio::spawn(async move {
        tokio_receiver_most_recent_items_request(response_receiver, db, feed_state_for_ws).await;
    });

    tokio::spawn(async move {
        tokio_user_ad_loop(user_ad_state_for_ads).await; 
    });

    let _ = MostRecentItems::get_most_recent_items(country, language, currency, request_sender).await;

    println!("http://127.0.0.1:8080");
    
    HttpServer::new(move || {

        App::new()
            .wrap(SessionMiddleware::new(CookieSessionStore::default(), key.clone()))
            .app_data(state.clone())
            .app_data(user_inventory.clone())
            .app_data(user_ad_state.clone())
            .app_data(feed_state.clone())
            .app_data(store_hashmap.clone())
            .app_data(chat_hub.clone())
            .app_data(websocket_list_state.clone())
            .service(Files::new("/front", "./front"))
            .route("/", web::get().to(tera_update_data))
            .service(web::scope("/api")
                .route("/logout", web::get().to(steam_logout)) 
                .route("/get_inventory_items", web::post().to(load_inventory))
                .route("/get_inventory_games", web::post().to(get_inventory_games))
                .route("/get_ad_cards_history", web::post().to(get_ad_cards_history)) 
                .route("/filters", web::get().to(post_most_recent_item_filters))
                .route("/add_to_ad_queue", web::post().to(add_ad_steam_user_to_db))
                .route("/add_to_store_queue", web::post().to(add_to_store_queue))
                .route("/remove_from_store_queue", web::post().to(remove_from_store_queue))
                .route("/auth/steam", web::get().to(steam_login))
                .route("/auth/steam/return", web::get().to(steam_return))
                .service(web::scope("/offer")
                    .route("/make_offer", web::post().to(offer_make_offer))
                    .route("/update_offer", web::post().to(offer_update_offer))
                    .route("/update_status_offer", web::post().to(offer_update_status_offer))
                    .route("/check_offer_to_pay", web::post().to(offer_check_offer_to_pay))
                )
            )
            .route("/store_rating", web::get().to(store_rating))
            .route("/ws", web::get().to(ws_handler)) 
            .route("/ws/ads", web::get().to(ws_ad_handler)) 
            .route("/ws/chat", web::get().to(ws_chat_handler)) 
            
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
