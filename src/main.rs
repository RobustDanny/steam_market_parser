use std::{time::Duration, sync::Arc};
use steam_market_parser::{CustomItems, MostRecentItems, Sort, SortDirection, SteamMostRecentResponse};
use actix_web::{web, App, HttpServer, Result, HttpResponse, Error, HttpRequest, rt,};
use tera::{Context, Tera};
use tokio::sync::mpsc;
use serde_json;
use actix_ws::AggregatedMessage;
use futures_util::StreamExt as _;

mod db;
use db::DataBase;
//Best time
    //thread::sleep(Duration::from_millis(1000));

async fn index(tmpl: web::Data<Tera>, items_data: web::Data<steam_market_parser::MostRecentItems>) -> Result<HttpResponse> {
    let mut context = Context::new();
    context.insert("items", items_data.get_ref());
    
    let rendered = tmpl.render("index.html", &context)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(rendered))
}

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

    let country = Some("NL".to_string());
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
        let (tx, rx) = mpsc::channel(100);
        
        tokio::spawn(async move {
            tokio_receiver(rx, db).await;
        });

        let items_result = MostRecentItems::get_most_recent_items(country, language, currency, tx).await;
        if let Ok(items) = &items_result {
            println!("{items:#?}");
        } else if let Err(e) = &items_result {
            eprintln!("Error fetching items: {e}");
        }

        //----------------------------------
        //----------------------------------
        //Tera HTML
        let tera = Tera::new("front/**/*")
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;
    
        // Store items and tera as shared application data
        let initial_items = match items_result {
            Ok(items) => items,
            Err(_) => steam_market_parser::MostRecentItems {
                listinginfo: std::collections::HashMap::new(),
                purchaseinfo: Vec::new(),
                assets: std::collections::HashMap::new(),
                currency: Vec::new(),
                app_data: std::collections::HashMap::new(),
            },
        };
        let items_data = web::Data::new(initial_items);
        let tera_data = web::Data::new(tera);
        //----------------------------------
        //----------------------------------


        //----------------------------------
        //----------------------------------
        //Server Actix
        HttpServer::new(move || {
            App::new()
                .app_data(tera_data.clone())
                .app_data(items_data.clone())
                .service(
                    web::scope("/")
                        .route("/", web::get().to(index))
                        .route("/api/items", web::get().to(api_items))
                        .route("/echo", web::get().to(echo))
                )
        })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
        //----------------------------------
        //----------------------------------
}

async fn api_items(items_data: web::Data<steam_market_parser::MostRecentItems>) -> Result<HttpResponse> {
    // Convert to JSON
    let json = serde_json::to_string(items_data.get_ref())
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .body(json))
}

async fn tokio_receiver(mut rx: mpsc::Receiver<SteamMostRecentResponse>, db: DataBase){
    while let Some(most_recent_items_response) = rx.recv().await {
        db.db_post_most_recent_items(most_recent_items_response);

        let result = db.db_get_most_recent_items();

        println!("got dammit= {result:#?}");
    }
}

async fn echo(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    let (res, mut session, stream) = actix_ws::handle(&req, stream)?;

    let mut stream = stream
        .aggregate_continuations()
        // aggregate continuation frames up to 1MiB
        .max_continuation_size(2_usize.pow(20));

    // start task but don't wait for it
    rt::spawn(async move {
        // receive messages from websocket
        while let Some(msg) = stream.next().await {
            match msg {
                Ok(AggregatedMessage::Text(text)) => {
                    // echo text message
                    session.text(text).await.unwrap();
                }

                Ok(AggregatedMessage::Binary(bin)) => {
                    // echo binary message
                    session.binary(bin).await.unwrap();
                }

                Ok(AggregatedMessage::Ping(msg)) => {
                    // respond to PING frame with PONG frame
                    session.pong(&msg).await.unwrap();
                }

                _ => {}
            }
        }
    });

    // respond immediately with response connected to WS session
    Ok(res)
}