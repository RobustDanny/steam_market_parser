use steam_market_parser::{MostRecentItemsFilter, CustomItems, MostRecentItems, 
    Sort, SortDirection, SteamMostRecentResponse, MostRecent, FilterInput};
use actix_web::{App, HttpResponse, HttpServer, Responder, web, cookie::Key};
use actix_files::Files;
use actix_session::{Session, SessionMiddleware, storage::CookieSessionStore};
use tera::{Context, Tera};
use tokio::sync::{mpsc, Mutex, broadcast};

mod db;
use db::DataBase;

mod websocket;
use websocket::{ws_handler, BroadcastPayload};

// use crate::db::MostRecent;

pub struct AppState {
    tera: Tera,
    items: Mutex<Vec<MostRecent>>,
    broadcaster: broadcast::Sender<BroadcastPayload>,
    // filter: Mutex<MostRecentItemsFilter>,
}

//Best time
    //thread::sleep(Duration::from_millis(1000));

#[actix_web::main]
async fn main()-> std::io::Result<()> {

    let db = DataBase::connect_to_db();

    let country = Some("US".to_string());
    let language = Some("english".to_string());
    let currency = Some("3".to_string());

    let (request_sender, response_receiver) = mpsc::channel(100);
    let (broadcast_sender_most_recent_items, _broadcast_reciever_most_recent_items) = broadcast::channel(32);

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
        
        let state = web::Data::new(AppState {
            tera: Tera::new("front/**/*").expect("Tera init failed"),
            items: Mutex::new(Vec::new()),
            broadcaster: broadcast_sender_most_recent_items,
            // filter: Mutex::new(MostRecentItemsFilter{
            //     appid: "Steam".to_string(),
            //     price_min: "100".to_string(),
            //     price_max: "150".to_string(),
            //     query: "".to_string(),
            // }),
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

            let key = Key::generate();


            App::new()
                .wrap(SessionMiddleware::new(CookieSessionStore::default(), key))
                .app_data(state.clone())
                .service(Files::new("/front", "./front"))
                .route("/", web::get().to(tera_update_data))
                .route("/ws", web::get().to(ws_handler)) 
                .route("/filters", web::get().to(post_most_recent_item_filters))
        })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
        //----------------------------------
        //----------------------------------
}

async fn check(session: Session)->Result<(), actix_web::Error> {
    match session.get::<FilterInput>("filters") {
        Ok(Some(filters)) => println!("User filters from session: {filters:#?}"),
        Ok(None) => println!("User filters not found in session."),
        Err(err) => println!("Failed to deserialize filters from session: {err}"),
    }
    Ok(())
}

async fn post_most_recent_item_filters(params: web::Query<FilterInput>,
    session: Session)-> impl Responder{

        session.insert("filters", &*params).unwrap();

        check(session).await.unwrap();
        // let mut filter = state.filter.lock().await;
        // *filter = MostRecentItemsFilter {
        //     appid: params.appid.clone(),
        //     price_min: params.price_min.clone(),
        //     price_max: params.price_max.clone(),
        //     query: params.query.clone(),
        // };
    
        HttpResponse::Ok().json(&*params)
}

async fn tokio_receiver_most_recent_items_request(
    mut receiver: mpsc::Receiver<SteamMostRecentResponse>,
    db: DataBase,
    state: web::Data<AppState>,
) {
    while let Some(most_recent_items_response) = receiver.recv().await {
        db.db_post_most_recent_items(most_recent_items_response);
        // let filters = state.filter.lock().await.clone();

        if let Ok(result) = db.db_get_most_recent_items() {
            {
                let mut items = state.items.lock().await;
                *items = result.clone();
                
            }
            let payload = BroadcastPayload {
                items: result.clone(),
            };
            // println!("got dammit= {result:#?}");
            let _ = state.broadcaster.send(payload);
        }
    }
}

async fn tera_update_data(session: Session, state: web::Data<AppState>) -> impl Responder {
    let items = state.items.lock().await.clone();
    let filters: FilterInput = session
    .get("filters")
    .unwrap()
    .unwrap_or(FilterInput {
        appid: "730".into(),
        price_min: "0".into(),
        price_max: "999999".into(),
        query: "".into(),
    });

    println!("filters: {filters:#?}");

    let mut ctx = Context::new();
    ctx.insert("most_recent_items", &items);
    ctx.insert("filters", &filters);

    state
        .tera
        .render("main.html", &ctx)
        .map(|body| HttpResponse::Ok().content_type("text/html").body(body))
        .map_err(|_| actix_web::error::ErrorInternalServerError("Template error"))
}