use std::{time::Duration};
use steam_market_parser::{MostRecentItemsFilter, CustomItems, MostRecentItems, 
    Sort, SortDirection, SteamMostRecentResponse};
use actix_web::{App, Error, HttpRequest, HttpResponse, HttpServer, Responder, Result, web};
use actix_files::Files;
use tera::{Context, Tera};
use tokio::sync::{mpsc, Mutex, broadcast};
use serde_json;
use actix::prelude::*;
use actix_web_actors::ws;


mod db;
use db::DataBase;

use crate::db::MostRecent;

struct AppState {
    tera: Tera,
    items: Mutex<Vec<MostRecent>>,
    broadcaster: broadcast::Sender<Vec<MostRecent>>,
    filter: Mutex<MostRecentItemsFilter>,
}

struct WsActor {
    state: web::Data<AppState>,
}

impl Actor for WsActor {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to broadcast channel and forward updates via actor messages
        let mut rx = self.state.broadcaster.subscribe();
        let addr = ctx.address();

        tokio::spawn(async move {
            while let Ok(items) = rx.recv().await {
                let _ = addr.do_send(BroadcastItems(items));
            }
        });
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsActor {
    fn handle(&mut self, _msg: Result<ws::Message, ws::ProtocolError>, _ctx: &mut Self::Context) {
        // No need to handle any incoming messages
    }
}

struct BroadcastItems(Vec<MostRecent>);

impl Message for BroadcastItems {
    type Result = ();
}

impl Handler<BroadcastItems> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: BroadcastItems, ctx: &mut Self::Context) {
        if let Ok(json) = serde_json::to_string(&msg.0) {
            ctx.text(json);
        }
    }
}

//Best time
    //thread::sleep(Duration::from_millis(1000));

#[actix_web::main]
async fn main()-> std::io::Result<()> {

    let db = DataBase::connect_to_db();
    // let count = None;
    // let page = None;
    // let game = Some(730);
    // let sort = Some(Sort::Price);
    // let search_descriptions = None;
    // let price_min = Some(50);
    // let price_max = Some(100);
    // let sort_dir = Some(SortDirection::Asc);
    // let query = None; 

    let country = Some("US".to_string());
    let language = Some("english".to_string());
    let currency = Some("3".to_string());

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
        let (request_sender, response_receiver) = mpsc::channel(100);
        let (broadcast_sender_most_recent_items, _broadcast_reciever_most_recent_items) = 
        broadcast::channel(32);
        
        let state = web::Data::new(AppState {
            tera: Tera::new("front/**/*").expect("Tera init failed"),
            items: Mutex::new(Vec::new()),
            broadcaster: broadcast_sender_most_recent_items,
            filter: Mutex::new(MostRecentItemsFilter{
                appid: "Steam".to_string(),
                price_min: "100".to_string(),
                price_max: "150".to_string(),
                query: "".to_string(),
            }),
        });
        let state_for_ws = state.clone();

        tokio::spawn(async move {
            tokio_receiver_most_recent_items_request(response_receiver, db, state_for_ws).await;
        });

        let _ = MostRecentItems::get_most_recent_items(country, language, currency, request_sender).await;
        
        
        //----------------------------------
        //----------------------------------
        //Server Actix
        HttpServer::new(move || {
            App::new()
                .app_data(state.clone())
                .service(Files::new("/front", "./front"))
                .route("/", web::get().to(tera_update_data))
                .route("/ws", web::get().to(ws_handler)) 
        })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
        //----------------------------------
        //----------------------------------
}

async fn tokio_receiver_most_recent_items_request(
    mut receiver: mpsc::Receiver<SteamMostRecentResponse>,
    db: DataBase,
    state: web::Data<AppState>,
) {
    while let Some(most_recent_items_response) = receiver.recv().await {
        db.db_post_most_recent_items(most_recent_items_response);
        
        if let Ok(result) = db.db_get_most_recent_items() {
            {
                let mut items = state.items.lock().await;
                *items = result.clone();
            }
            // println!("got dammit= {result:#?}");
            let _ = state.broadcaster.send(result);
        }
    }
}

async fn tera_update_data(state: web::Data<AppState>) -> impl Responder {
    let items = state.items.lock().await.clone();
    let filters = state.filter.lock().await.clone();

    let mut ctx = Context::new();
    ctx.insert("most_recent_items", &items);
    ctx.insert("filters", &filters);

    state
        .tera
        .render("main.html", &ctx)
        .map(|body| HttpResponse::Ok().content_type("text/html").body(body))
        .map_err(|_| actix_web::error::ErrorInternalServerError("Template error"))
}

async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let ws = WsActor {
        state: state.clone(),
    };

    ws::start(ws, &req, stream)
}