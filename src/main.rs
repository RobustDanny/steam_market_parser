use std::{thread, time::Duration};

use steam_market_parser::{Boolean, ItemVec, SortDirection, Sort};

#[tokio::main]
async fn main() {

    //-------------------
    //Filters
    // let count = None;
    // let page = None;
    // let game = Some(362890);
    // let next_page: Boolean = Boolean::YesNo(false);
    // let sort = Some(Sort::Price);
    // let search_descriptions = None;
    // let price_min = Some(50);
    // let price_max = Some(100);
    // let sort_dir = Some(SortDirection::Asc);
    // let query: Option<String> = None; 

    let country = Some("NL".to_string());
    let language = Some("english".to_string());
    let currency = Some("3".to_string());

    //-------------------


        // match ItemVec::get_items_query(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max, next_page).await {
        //     Ok(_items) => {
        //         // println!("{items:#?}");
        //     }
        //     Err(e) => {
        //         eprintln!("Error fetching items: {e}");
        //     }
        // }

        loop{
            match ItemVec::get_most_recent_items_vec(&country, &language, &currency).await {
            Ok(items) => {
                println!("{items:#?}");
            }
            Err(e) => {
                eprintln!("Error fetching items: {e}");
            }
        }
        thread::sleep(Duration::from_millis(1000));
    }
    //Best time
    //thread::sleep(Duration::from_millis(1000));
}
