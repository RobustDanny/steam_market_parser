use std::{thread, time::Duration};
use steam_market_parser::{CustomItems, SortDirection, Sort, MostRecentItems};
use actix_files::NamedFile;
use actix_web::{web, App, HttpServer, Result};
use std::path::PathBuf;
use tera::{Context, Tera};
//Best time
    //thread::sleep(Duration::from_millis(1000));

async fn index() -> Result<NamedFile> {
    let path: PathBuf = "./front/index.html".into();  // Adjust path as needed (relative to binary)
    Ok(NamedFile::open(path)?)
}

#[actix_web::main]
async fn main()-> std::io::Result<()> {
    //-------------------
    //Filters
    let count = None;
    let page = None;
    let game = Some(730);
    let sort = Some(Sort::Price);
    let search_descriptions = None;
    let price_min = Some(50);
    let price_max = Some(100);
    let sort_dir = Some(SortDirection::Asc);
    let query: Option<String> = None; 

    let country = Some("NL".to_string());
    let language = Some("english".to_string());
    let currency = Some("3".to_string());

    //-------------------
        let items = match CustomItems::get_items_query(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max).await {
            Ok(items) => items.vec,
            Err(e) => {
                eprintln!("Error fetching items: {e}");
                Vec::new()
            }
        };

        // loop{
        //     match MostRecentItems::get_most_recent_items(&country, &language, &currency).await {
        //     Ok(items) => {
        //         println!("{items:#?}");
        //     }
        //     Err(e) => {
        //         eprintln!("Error fetching items: {e}");
        //     }
        // }
        // thread::sleep(Duration::from_millis(1000));
        // }

        let tera = Tera::new("front/**/*")
            .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;
        let mut context = Context::new();
        context.insert("items", &items);

        let rendered_html = match tera.render("index.html", &context) {
            Ok(html) => html,
            Err(err) => {
                return Err(std::io::Error::new(std::io::ErrorKind::Other, err));
            }
        };
        println!("{}", rendered_html);

        HttpServer::new(|| {
            App::new().service(
                web::scope("/")
                    .route("/", web::get().to(index)),
            )
        })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await

}
