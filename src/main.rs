use std::{time::Duration, sync::Arc};
use steam_market_parser::MostRecentItems;
use actix_web::{web, App, HttpServer, Result, HttpResponse};
use tera::{Context, Tera};
use tokio::sync::RwLock;
use serde_json;

type SharedItems = Arc<RwLock<steam_market_parser::MostRecentItems>>;

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
    //-------------------
    //Filters
    let shared_items: SharedItems = Arc::new(RwLock::new(steam_market_parser::MostRecentItems {
        listinginfo: std::collections::HashMap::new(),
        purchaseinfo: Vec::new(),
        assets: std::collections::HashMap::new(),
        currency: Vec::new(),
        app_data: std::collections::HashMap::new(),
    }));

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
    // let items = match CustomItems::get_items_query(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max).await {
    //     Ok(items) => {
    //         let mut shared = shared_items.write().await;
    //         *shared = items.vec;
    //         println!("Initial items loaded: {} items", shared.len());
    //     }
    //     Err(e) => {
    //         eprintln!("Error fetching initial items: {e}");
    //     }
    // };

        let items_result = MostRecentItems::get_most_recent_items(&country, &language, &currency).await;
        if let Ok(items) = &items_result {
            println!("{items:#?}");
        } else if let Err(e) = &items_result {
            eprintln!("Error fetching items: {e}");
        }
        // thread::sleep(Duration::from_millis(1000));

        // Spawn background task
        let shared_items_clone = shared_items.clone();
        tokio::spawn(async move {
            fetch_items_loop(shared_items_clone).await;
        });

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

        HttpServer::new(move || {
            App::new()
                .app_data(tera_data.clone())
                .app_data(items_data.clone())
                .service(
                    web::scope("/")
                        .route("/", web::get().to(index))
                        .route("/api/items", web::get().to(api_items)), // NEW: API endpoint
                )
        })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await

}

async fn api_items(items_data: web::Data<SharedItems>) -> Result<HttpResponse> {
    let items = items_data.read().await;
    
    // Convert to JSON
    let json = serde_json::to_string(&*items)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .body(json))
}

// Background task to continuously fetch items
async fn fetch_items_loop(shared_items: SharedItems) {
    //-------------------
    //Filters
    let country = Some("NL".to_string());
    let language = Some("english".to_string());
    let currency = Some("3".to_string());

    loop {
        match MostRecentItems::get_most_recent_items(&country, &language, &currency).await {
            Ok(items) => {
                // Update shared state
                let mut shared = shared_items.write().await;
                *shared = items;
                println!("Updated items: {} listings fetched", shared.listinginfo.len());
            }
            Err(e) => {
                eprintln!("Error fetching items: {e}");
            }
        }
        
        // Wait before next fetch (adjust as needed)
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}
