use std::arch::x86_64::_MM_FROUND_NO_EXC;

use serde::{Deserialize, Serialize};
// use serde_json::{Value};
use reqwest;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

pub enum Boolean{
    YesNo(bool),
}

pub enum Sort{
    Name,
    Price,
    Quantity,
    Popular,
}

pub enum SortDirection{
    Asc,
    Desc,
}

#[derive(Deserialize, Serialize, Debug)]
struct MarketRequest{
    game: u32,
    page: u32,
    count: u32,
    query: String,
    sort: String,
    sort_dir: String,
    search_descriptions: bool,
    price_min: u32,
    price_max: u32,
}

#[derive(Deserialize, Serialize, Debug)]
struct SteamMarketResponse {
    success: bool,
    start: u32,
    pagesize: u32,
    total_count: u32,
    searchdata: SearchData,
    results: Vec<Item>,
}

#[derive(Deserialize, Serialize, Debug)]
struct SearchData {
    query: String,
    search_descriptions: bool,
    total_count: u32,
    pagesize: u32,
    prefix: String,
    class_prefix: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct ItemVec{
    pub vec: Vec<Item>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Item {
    // id: usize,
    name: String,
    hash_name: String,
    sell_listings: u32,
    sell_price: u32,
    sell_price_text: String,
    app_icon: String,
    app_name: String,
    asset_description: Description,
    sale_price_text: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct Description {
    appid: u32,
    classid: String,
    instanceid: String,
    background_color: Option<String>,
    icon_url: String,
    tradable: usize,
    name: String,
    name_color: Option<String>,
    #[serde(rename = "type")]
    item_type: String,
    market_name: String,
    market_hash_name: String,
    commodity: u32,
}

trait SteamRequest{
    
    async fn process_custom_market_url(game: Option<u32>, count: Option<u32>, page: Option<u32>, query: Option<String>,
        sort: Option<Sort>, sort_dir: Option<SortDirection>, search_descriptions: Option<bool>, price_min: Option<u32>,
        price_max: Option<u32>, next_page: Boolean) -> Result<SteamMarketResponse>{

        let request_parametrs = MarketRequest::request_paramentrs(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max, next_page);

        let url = Self::make_custom_market_url(request_parametrs).await;

        let json_response = Self::send_request(url).await?;

        println!("{:#?}", json_response);

        Ok(json_response)
    }

    async fn make_custom_market_url(request: MarketRequest) -> String {

        let url = format!("https://steamcommunity.com/market/search/render/
        ?appid={}&start={}&query={}&sort={}&sort_dir={}&search_descriptions={}&price_min={}&price_max={}&norender=1",
        request.game, request.page, request.query, request.sort, request.sort_dir, request.search_descriptions, request.price_min, request.price_max);

        url

    }

    async fn send_request(url: String) -> Result<SteamMarketResponse>{
        
        let client = reqwest::Client::new();

        let respond = client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await?
            .text()
            .await?;

        let respond: SteamMarketResponse = serde_json::from_str(&respond)?;
        Ok(respond)
    }
}

impl SteamRequest for ItemVec{
}

impl MarketRequest{
    fn request_paramentrs(game: Option<u32>, count: Option<u32>, page: Option<u32>, query: Option<String>,
        sort: Option<Sort>, sort_dir: Option<SortDirection>, search_descriptions: Option<bool>, price_min: Option<u32>,
        price_max: Option<u32>, next_page: Boolean)-> MarketRequest{

        let game = match game{
            Some(appid) => appid,
            None => 730,
        };

        //---------------------
        //In case you will find how to work with items counting 
        let count = match count{
            Some(count) => count,
            None => 10,
        };
        //---------------------
        
        let page = match page{
            Some(page) => {
                match next_page{
                    Boolean::YesNo(true) => page + 1,
                    Boolean::YesNo(false) => page,
                }
            },
            None => 0,
        };

        let query = match query{
            Some(query) => query.to_string(),
            None => "".to_string(),
        };

        
        let sort = match sort{
            Some(sort) => {
                match sort {
                    Sort::Name => "name".to_string(),
                    Sort::Popular => "popular".to_string(),
                    Sort::Quantity => "quantity".to_string(),
                    Sort::Price => "price".to_string(),
                }
            }
            None => "".to_string(),
        };

        let sort_dir = match sort_dir {
            Some(dir) => {
                match dir {
                    SortDirection::Asc => "asc".to_string(),
                    SortDirection::Desc => "desc".to_string(),
                }
            }
            None => "".to_string(),
        };        

        let search_descriptions = match search_descriptions {
            Some(bool) => bool,
            None => false,
        };

        let price_min = match price_min{
            Some(price) => price * 100,
            None => 0,
        };

        let price_max = match price_max{
            Some(price) => price * 100,
            None => 1e12 as u32,
        };



        let request = MarketRequest{
            game,
            page,
            count,
            query,
            sort,
            sort_dir,
            search_descriptions,
            price_min,
            price_max,
        };

        println!("{request:#?}");

        request

    }
}

impl ItemVec{
    pub async fn get_items_query(game: Option<u32>, count: Option<u32>, page: Option<u32>, query: Option<String>,
        sort: Option<Sort>, sort_dir: Option<SortDirection>, search_descriptions: Option<bool>, price_min: Option<u32>,
        price_max: Option<u32>, next_page: Boolean)-> Result<Self>{

        let response_result = Self::process_custom_market_url(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max, next_page).await?;

        Ok(ItemVec { vec: response_result.results })
    }

    pub async fn get_next_items_query(game: Option<u32>, count: Option<u32>, page: Option<u32>, query: Option<String>,
        sort: Option<Sort>, sort_dir: Option<SortDirection>, search_descriptions: Option<bool>, price_min: Option<u32>,
        price_max: Option<u32>, next_page: Boolean)-> Result<Self>{

        let response_result = Self::process_custom_market_url(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max, next_page).await?;

        Ok(ItemVec { vec: response_result.results })
    }

    // pub async fn get_items_default()-> Result<Self>{
    //     let request_parametrs = MarketRequest::request_paramentrs(Some(730), Some(10), Some(0), Some("".to_string()), Boolean::YesNo(false));

    //     let url = Self::make_custom_market_url(request_parametrs).await;

    //     let json_response = Self::send_request(url).await?;

    //     Ok(ItemVec { vec: json_response.results })
    // }
}

