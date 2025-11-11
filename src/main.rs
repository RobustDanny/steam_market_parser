use std::{thread, time::Duration};

use steam_market_parser::{Boolean, ItemVec, SortDirection, Sort};

#[tokio::main]
async fn main() {

    //-------------------
    //Filters
    let count = None;
    let page = None;
    let game = None;
    let next_page: Boolean = Boolean::YesNo(false);
    let sort = Some(Sort::Price);
    let search_descriptions = None;
    let price_min = Some(50);
    let price_max = Some(100);
    let sort_dir = Some(SortDirection::Asc);
    //-------------------

    let query: Option<String> = None;

        match ItemVec::get_items_query(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max, next_page).await {
            Ok(_items) => {
                // println!("{items:#?}");
            }
            Err(e) => {
                eprintln!("Error fetching items: {e}");
            }
        }
        thread::sleep(Duration::from_secs(5));
}
