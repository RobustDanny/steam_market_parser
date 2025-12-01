use std::{collections::{HashMap, VecDeque}, time::Duration};
use tokio::sync::{mpsc};
use serde::{Deserialize, Serialize};

mod steam_request;
use steam_request::{ProcessSteamRequest, SteamRequest};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

#[derive(Clone, Copy)]
pub enum Sort{
    Name,
    Price,
    Quantity,
    Popular,
}

#[derive(Clone, Copy)]
pub enum SortDirection{
    Asc,
    Desc,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct SteamUser{
    pub steamid: String,
    pub nickname: String,
    pub avatar_url_small: String,
    pub avatar_url_full: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserProfileAds{
    pub steamid: String,
    pub name: String,
    pub image: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserAdsQueue{
    pub queue: VecDeque<UserProfileAds>,
}

//----------------------------------
//----------------------------------
//Requests
#[derive(Deserialize, Serialize, Debug)]
pub struct MarketRequest{
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

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MostRecentItemsRequest{
    country: String,
    language: String,
    currency: String,
}
//----------------------------------
//----------------------------------

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MostRecentItemsFilter{
    pub appid: String,
    pub price_min: String,
    pub price_max: String,
    pub query: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FilterInput {
    pub appid: String,
    pub price_min: String,
    pub price_max: String,
    pub query: String,
}

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

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct SteamMostRecentResponse {
    success: bool,
    more: bool,
    results_html: bool,
    pub listinginfo: HashMap<String, Listinginfo>,
    purchaseinfo: Vec<Purchaseinfo>,
    pub assets: HashMap<String, HashMap<String, HashMap<String, Assets>>>,
    currency: Vec<Currency>,
    pub app_data: HashMap<String, AppData>,
    hovers: Option<bool>,
    last_time: usize,
    pub last_listing: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Listinginfo{
    pub listingid: String,
    pub price: f64,
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
    pub asset: ListinginfoAsset,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ListinginfoAsset{
    currency: usize,
    pub appid: usize,
    pub contextid: String,
    pub id: String,
    amount: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Assets{
    currency: usize,
    appid: usize,
    contextid: String,
    id: String,
    classid: String,
    instanceid: String,
    amount: String,
    status: usize,
    original_amount: String,
    unowned_id: Option<String>,
    unowned_contextid: Option<String>,
    background_color: Option<String>,
    pub icon_url: Option<String>,
    icon_url_large: Option<String>,
    descriptions: Option<Vec<AssetDescription>>,
    pub tradable: Option<usize>,
    owner_actions: Option<Vec<OwnerActions>>,
    name: Option<String>,
    name_color: Option<String>,
    pub market_name: Option<String>,
    pub market_hash_name: Option<String>,
    market_fee_app: Option<isize>,
    commodity: Option<isize>,
    market_tradable_restriction: Option<isize>,
    market_marketable_restriction: Option<isize>,
    marketable: Option<usize>,
    app_icon: Option<String>,
    owner: Option<isize>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OwnerActions{
    link: Option<String>,
    name: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AssetDescription{
    value: Option<String>,
    color: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Purchaseinfo{}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Currency{}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AppData{
    appid: usize,
    pub name: String,
    pub icon: String,
    link: String,
}
//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//Serialized request data
#[derive(Deserialize, Serialize, Debug)]
pub struct MostRecentItems{
    pub listinginfo: HashMap<String, Listinginfo>,
    pub purchaseinfo: Vec<Purchaseinfo>,
    pub assets: HashMap<String, HashMap<String, HashMap<String, Assets>>>,
    pub currency: Vec<Currency>,
    pub app_data: HashMap<String, AppData>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct CustomItems{
    pub vec: Vec<Item>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Item {
    pub name: String,
    pub hash_name: String,
    pub sell_listings: u32,
    pub sell_price: u32,
    pub sell_price_text: String,
    pub app_icon: String,
    pub app_name: String,
    pub asset_description: Description,
    pub sale_price_text: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Description {
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

//DB
#[derive(Clone, Debug, Serialize)]
pub struct MostRecent{
    pub id: usize,
    pub listinginfo_id: String,
    pub name: String,
    pub price: String,
    pub appid: String,
    pub game: String,
    pub market_hash_name: String,
    pub tradable: String,
    pub icon: String,
    pub game_icon: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct DBFiltersMostRecentItems{
    pub filters: String,
}

//----------------------------------
//----------------------------------
//Trait bounds

//Allow to send requests and get access to ProcessSteamRequest methods
impl SteamRequest for SteamMarketResponse{}
impl SteamRequest for SteamMostRecentResponse{}

//Allow to use methods of ProcessSteamRequest trait
impl ProcessSteamRequest for MarketRequest{}
impl ProcessSteamRequest for MostRecentItemsRequest{}
//----------------------------------
//----------------------------------

impl CustomItems{

    pub async fn get_items_query(game: Option<u32>, count: Option<u32>, page: Option<u32>, query: Option<String>,
        sort: Option<Sort>, sort_dir: Option<SortDirection>, search_descriptions: Option<bool>, price_min: Option<u32>,
        price_max: Option<u32>)-> Result<Self>{

        let response_result = MarketRequest::request_paramenters(game, count, page, query, sort, sort_dir, search_descriptions, price_min, price_max).await?;

        Ok(CustomItems { vec: response_result.results })
    }
}

impl MostRecentItems{
    pub async fn get_most_recent_items(country: Option<String>, language: Option<String>, currency: Option<String>, 
        tx: mpsc::Sender<SteamMostRecentResponse>) -> Result<Self>{
        
        //Making request struct
        let most_recent_struct = MostRecentItemsRequest::request_paramenters(country, language, currency);

        //Get url with request data
        let url = MostRecentItemsRequest::most_recent_items_url(most_recent_struct.clone());
        
        //Make initial request
        let response_result: Result<SteamMostRecentResponse> = MostRecentItemsRequest::process_request(url.clone()).await;

        //Spawn background task for loop
        tokio::spawn(async move {
            Self::fetch_items_loop(url, tx).await;
        });

        match response_result {
            Ok(response) => Ok(MostRecentItems{
                listinginfo: response.listinginfo,
                purchaseinfo: response.purchaseinfo,
                assets: response.assets,
                currency: response.currency,
                app_data: response.app_data,
            }),
            Err(e) => Err(e),
        }
    }

    
    ///---------------------------------------------------------------------
    ///Dont use more than 1 async thread for MostRecentItems for request!!!
    ///fetch_items_loop is enough
    ///---------------------------------------------------------------------

    async fn fetch_items_loop(url: String, tx: mpsc::Sender<SteamMostRecentResponse>) {

        loop {
            let response: Result<SteamMostRecentResponse> = MostRecentItemsRequest::process_request(url.clone()).await;

            match response {
                Ok(items) => {
                    tx.send(items.clone()).await.expect("Cant send SteamMostResponse via channel")
                }
                Err(e) => {
                    eprintln!("Error fetching items: {e}")
                }
            };

            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    }
}

impl MarketRequest{
    async fn request_paramenters(game: Option<u32>, count: Option<u32>, page: Option<u32>, query: Option<String>,
        sort: Option<Sort>, sort_dir: Option<SortDirection>, search_descriptions: Option<bool>, price_min: Option<u32>,
        price_max: Option<u32>)-> Result<SteamMarketResponse>{

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
            Some(page) => page,
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

        let url = Self::custom_market_url(request);

        let response_result = Self::process_request(url).await?;

        Ok(response_result)
    }
}

impl MostRecentItemsRequest {

    fn request_paramenters(country: Option<String>, language: Option<String>, currency: Option<String>)-> MostRecentItemsRequest{

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

        let most_recent_items_request_struct = MostRecentItemsRequest{
            country,
            language,
            currency,
        };

        // Regular url
        // let url = Self::most_recent_items_url(request);

        // Regular response
        // let response_result = Self::process_request(url).await?;

        most_recent_items_request_struct
    }
}
