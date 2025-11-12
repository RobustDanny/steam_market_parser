use std::{arch::x86_64::_MM_FROUND_NO_EXC, array, collections::HashMap};

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


//----------------------------------
//----------------------------------
//Requests
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
struct MostRecentItemsRequest{
    country: String,
    language: String,
    currency: String,
}
//----------------------------------
//----------------------------------


//----------------------------------
//----------------------------------
//Response
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
struct SteamMostRecentResponse {
    success: bool,
    more: bool,
    results_html: bool,
    listinginfo: HashMap<String, Listinginfo>,
    purchaseinfo: Vec<Purchaseinfo>,
    assets: HashMap<String, HashMap<String, HashMap<String, Assets>>>,
    currency: Vec<Currency>,
    app_data: HashMap<String, AppData>,
    hovers: Option<bool>,
    last_time: usize,
    last_listing: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct Listinginfo{
    listingid: String,
    price: usize,
    fee: usize,
    publisher_fee_app: usize,
    publisher_fee_percent: String,
    currencyid: usize,
    steam_fee: Option<usize>,
    publisher_fee: Option<usize>,
    converted_price: Option<usize>,
    converted_fee: Option<usize>,
    converted_currencyid: Option<usize>,
    converted_steam_fee: Option<usize>,
    converted_publisher_fee: Option<usize>,
    converted_price_per_unit: Option<usize>,
    converted_fee_per_unit: Option<usize>,
    converted_steam_fee_per_unit: Option<usize>,
    converted_publisher_fee_per_unit: Option<usize>,
    asset: ListinginfoAsset,
}

#[derive(Deserialize, Serialize, Debug)]
struct ListinginfoAsset{
    currency: usize,
    appid: usize,
    contextid: String,
    id: String,
    amount: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct Assets{
    currency: usize,
    appid: usize,
    contextid: String,
    id: String,
    classid: String,
    instanceid: String,
    amount: String,
    status: usize,
    original_amount: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct Purchaseinfo{}

#[derive(Deserialize, Serialize, Debug)]
struct Currency{}

#[derive(Deserialize, Serialize, Debug)]
struct AppData{
    appid: usize,
    name: String,
    icon: String,
    link: String,
}
//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//Serialized request data
#[derive(Deserialize, Serialize, Debug)]
pub struct MostRecentItemsVec{
    listinginfo: HashMap<String, Listinginfo>,
    purchaseinfo: Vec<Purchaseinfo>,
    assets: HashMap<String, HashMap<String, HashMap<String, Assets>>>,
    currency: Vec<Currency>,
    app_data: HashMap<String, AppData>,

}

#[derive(Deserialize, Serialize, Debug)]
pub struct ItemVec{
    pub vec: Vec<Item>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Item {
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
//----------------------------------
//----------------------------------

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

    async fn process_most_recent_items(country: &Option<String>, language: &Option<String>, currency: &Option<String>) -> Result<SteamMostRecentResponse>{

        let request_parametrs = MostRecentItemsRequest::request_paramentrs(country, language, currency);

        let url = Self::get_most_recent_items(request_parametrs).await;

        let json_response = Self::send_most_recent_request(url).await?;

        println!("{:#?}", json_response);

        Ok(json_response)
    }

    async fn make_custom_market_url(request: MarketRequest) -> String {

        let url = format!("https://steamcommunity.com/market/search/render/
        ?appid={}&start={}&query={}&sort={}&sort_dir={}&search_descriptions={}&price_min={}&price_max={}&norender=1",
        request.game, request.page, request.query, request.sort, request.sort_dir, request.search_descriptions, request.price_min, request.price_max);

        url

    }

    async fn get_most_recent_items(request: MostRecentItemsRequest) -> String{

        let url = format!("https://steamcommunity.com/market/recent?country={}&language={}&currency={}&norender=1", 
        request.country, request.language, request.currency);
        println!("{url}");
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

    async fn send_most_recent_request(url: String) -> Result<SteamMostRecentResponse>{
        
        let client = reqwest::Client::new();

        let respond = client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await?
            .text()
            .await?;
        
        let respond: SteamMostRecentResponse = serde_json::from_str(&respond)?;
        println!("{respond:#?}");
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

impl MostRecentItemsRequest {
    fn request_paramentrs(country: &Option<String>, language: &Option<String>, currency: &Option<String>)-> MostRecentItemsRequest{

        let country = match country{
            Some(country) => country.to_string(),
            None => "US".to_string(),
        };

        let language = match language{
            Some(language) => language.to_string(),
            None => "english".to_string(),
        };

        let currency = match currency{
            Some(currency) => currency.to_string(),
            None => "3".to_string(),
        };

        let request = MostRecentItemsRequest{
            country,
            language,
            currency,
        };

        // println!("{request:#?}");

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

    pub async fn get_most_recent_items_vec(country: &Option<String>, language: &Option<String>, currency: &Option<String>)-> Result<MostRecentItemsVec>{

        let response_result = Self::process_most_recent_items(country, language, currency).await?;

        Ok(MostRecentItemsVec{
            listinginfo: response_result.listinginfo,
            purchaseinfo: response_result.purchaseinfo,
            assets: response_result.assets,
            currency: response_result.currency,
            app_data: response_result.app_data,
        })
    }

    // pub async fn get_items_default()-> Result<Self>{
    //     let request_parametrs = MarketRequest::request_paramentrs(Some(730), Some(10), Some(0), Some("".to_string()), Boolean::YesNo(false));

    //     let url = Self::make_custom_market_url(request_parametrs).await;

    //     let json_response = Self::send_request(url).await?;

    //     Ok(ItemVec { vec: json_response.results })
    // }
}

