use std::{collections::{HashMap, VecDeque}, time::Duration};
use tokio::sync::{mpsc, Mutex};
use actix_web::{Responder, HttpResponse, HttpRequest, body::BoxBody, http::header::ContentType};

use serde::{Deserialize, Serialize, Deserializer};

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
//----------------------------------
//----------------------------------
//HTTP Playloads
#[derive(Deserialize, Serialize, Debug)]
pub struct OfferMakingPlayload{
    pub offer_id: String,
}

impl Responder for OfferMakingPlayload{
    type Body = BoxBody;

    fn respond_to(self, _req: &HttpRequest) -> HttpResponse<Self::Body> {
        let body = serde_json::to_string(&self).unwrap();

        // Create response and set content type
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .body(body)
    }
}

#[derive(Deserialize, Serialize, Debug)]
pub struct OfferContentUpdated{
    pub offer_id: String,
    pub total_price: f64,
    pub total_count: i32,
    pub new_items: Vec<OfferItems>,
    pub removed_items: Vec<OfferItems>,
    pub updated_items: Vec<OfferItems>,
    pub added_items: Vec<OfferItems>
}

impl Responder for OfferContentUpdated{
    type Body = BoxBody;

    fn respond_to(self, _req: &HttpRequest) -> HttpResponse<Self::Body> {
        let body = serde_json::to_string(&self).unwrap();

        // Create response and set content type
        HttpResponse::Ok()
            .content_type(ContentType::json())
            .body(body)
    }
}

//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//Steam user
#[derive(Deserialize, Serialize, Debug)]
pub struct SteamUser{
    pub steamid: String,
    pub nickname: String,
    pub avatar_url_small: String,
    pub avatar_url_full: String,
    pub status: String,
}
//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//History of ad_cards

#[derive(Deserialize, Serialize, Debug)]
pub struct HistoryForm{
    pub steamid: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct AdCardHistoryVec{
    pub ad_card_vec: Vec<UserProfileAds>,
}

//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//Chat websockets
#[derive(Deserialize)]
pub struct ChatQuery {
    pub buyer: String,
    pub trader: String,
    pub role: Option<String>, // "buyer" | "trader"
}

#[derive(Deserialize, Debug)]
pub struct ChatSessionPlayload {
    pub buyer: String,
    pub trader: String,
}

//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//Store Queue
#[derive(Debug)]
pub struct StoreQueueHashmap{
    pub hashmap: HashMap<String, Mutex<VecDeque<String>>>,
}

#[derive(Deserialize)]
pub struct BuyerAndStoreIDS{
    pub buyer_id: String,
    pub trader_id: String,
}

#[derive(Deserialize)]
pub struct StoreID{
    pub trader_id: String,
}

#[derive(Deserialize)]
pub struct OfferContent{
    pub offer_id: String,
    pub special_for_update_offer: Vec<OfferItems>,
}

#[derive(Deserialize, Debug)]
pub struct OfferContentToCheck{
    pub offer_id: String,
    pub special_for_save_offer: Vec<OfferItems>,
    pub partner_steam_id: String,
}

#[derive(Clone, Deserialize, Serialize, Debug, PartialEq)]
pub struct OfferItems{
    pub item_asset_id: String,
    pub item_contextid: String,
    pub item_appid: String,
    pub item_name: String,
    pub item_price: String,
    pub item_link: String,
    pub item_image: String,
}

#[derive(Deserialize)]
pub struct CurrentStatusOffer{
    pub offer_id: String,
    pub status: String,
}

#[derive(Deserialize, Debug)]
pub struct OfferCheckResult{
    pub offer_id: String,
    pub check_result: bool,
    pub offer_items: Vec<OfferItems>,
    pub partner_trade_url: String,
}

//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//Trade offer draft
#[derive(Serialize)]
pub struct DraftItem {
    pub appid: u32,
    pub contextid: String,
    pub assetid: String,
    pub amount: u32,
}

#[derive(Serialize)]
pub struct OfferDraft {
    pub give: Vec<DraftItem>,
    pub autosend: bool,
}
//----------------------------------
//----------------------------------


//----------------------------------
//----------------------------------
//Profile settings

#[derive(Debug, Serialize, Deserialize)]
pub struct ProfileTradeUrl{
    pub steam_id: String,
    pub trade_url: String,
}

//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//User inventory

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadGameInventory{
    pub store_steamid: String,
}

#[derive(Debug, Deserialize)]
pub struct AppContext {
    pub appid: u32,
    pub name: String,
    pub asset_count: u32,
}

#[derive(Debug, Serialize)]
pub struct InventoryGame {
    pub appid: u32,
    pub name: String,
    pub items: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InventoryApp{
    pub settings_steamid: String,
    pub settings_appid: String,
}

//One Item
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Inventory {
    pub assets: Vec<Asset>,
    pub descriptions: Vec<ItemDescription>,
    pub asset_properties: Vec<AssetProperty>,
    pub total_inventory_count: Option<u32>,
    pub success: Option<u32>,
    pub rwgrsn: Option<i32>,
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Asset {
    pub appid: Option<u32>,
    pub contextid: Option<String>,
    pub assetid: Option<String>,
    pub classid: Option<String>,
    pub instanceid: Option<String>,
    pub amount: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct ItemDescription {
    pub appid: Option<u32>,
    pub classid: Option<String>,
    pub instanceid: Option<String>,
    pub currency: Option<u32>,
    pub background_color: Option<String>,
    pub icon_url: Option<String>,
    pub descriptions: Option<Vec<DescriptionText>>,
    pub tradable: Option<u32>,
    pub actions: Option<Vec<Action>>,
    pub name: Option<String>,
    pub name_color: Option<String>,

    #[serde(rename = "type")]
    pub item_type: Option<String>,

    pub market_name: Option<String>,
    pub market_hash_name: Option<String>,
    pub commodity: Option<u32>,
    pub market_tradable_restriction: Option<u32>,
    pub marketable: Option<u32>,
    pub tags: Option<Vec<Tag>>,
    pub sealed: Option<u32>,
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct DescriptionText {
    #[serde(rename = "type")]
    pub description_type: Option<String>,
    pub value: Option<String>,
    pub name: Option<String>,
    pub color: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Action {
    pub link: Option<String>,
    pub name: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Tag {
    pub category: Option<String>,
    pub internal_name: Option<String>,
    pub localized_category_name: Option<String>,
    pub localized_tag_name: Option<String>,
    pub color: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct AssetProperty {
    pub appid: Option<u32>,
    pub contextid: Option<String>,
    pub assetid: Option<String>,
    pub asset_properties: Option<Vec<Property>>,
}

///Need to fix Option<serde_json::Value>!!!
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Property {
    pub propertyid: Option<u32>,
    pub float_value: Option<serde_json::Value>,
    pub int_value: Option<serde_json::Value>,
    pub string_value: Option<String>,
    pub name: Option<String>,
}

//----------------------------------
//----------------------------------
//User ads

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserProfileAds{
    pub steamid: String,
    pub nickname: String,
    pub avatar: String,
    pub first_item_image: String,
    pub second_item_image: String,
    pub third_item_image: String,
    pub fourth_item_image: String,
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

#[derive(Deserialize, Serialize, Debug)]
pub struct TradeOfferRequest{
    // partner_steam_id: String,
    pub partner_trade_url: String,
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

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct CardAppearingFilter{
    pub card_appearing: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FilterInput {
    pub appid: String,
    pub price_min: String,
    pub price_max: String,
    pub query: String,
    pub card_appearing: String,
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum CardAppearing {
    StoresItems,
    Items,
    Ads,
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
    pub converted_price: Option<usize>,
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
    pub converted_price: String,
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
//Customer creating

pub struct UserParamsFromDB{
    pub user_steam_id: String,
    pub user_name: String,
    pub user_trade_url: String,
}

//----------------------------------
//----------------------------------

//----------------------------------
//----------------------------------
//Transaction fees

pub enum PaymentMethodEnum{
    STRIPE(String),
    BITCOIN(String),
}

pub enum PaymentMethodFeeEnum{
    STRIPE(f64),
    BITCOIN(f64),
}

//----------------------------------
//----------------------------------
//Trait bounds

//Allow to send requests and get access to ProcessSteamRequest methods
impl SteamRequest for SteamMarketResponse{}
impl SteamRequest for SteamMostRecentResponse{}
impl SteamRequest for TradeOfferRequest{}

//Allow to use methods of ProcessSteamRequest trait
impl ProcessSteamRequest for MarketRequest{}
impl ProcessSteamRequest for MostRecentItemsRequest{}
impl ProcessSteamRequest for TradeOfferRequest{}
//----------------------------------
//----------------------------------

impl StoreQueueHashmap{
    pub fn new()->Self {
        StoreQueueHashmap { 
            hashmap: HashMap::new(),
        }
    }
}

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

            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    }
}

impl TradeOfferRequest{
    pub async fn request_paramenters(trade_url: String)-> Result<Self>{

        let request = TradeOfferRequest{
            partner_trade_url: trade_url,
        };

        let response_result = Self::process_request(request.partner_trade_url).await?;

        println!("{response_result:#?}");

        Ok(response_result)

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

// fn de_opt_u32_from_str_or_num<'de, D>(deserializer: D) -> Result<Option<u32>, D::Error>
// where
//     D: Deserializer<'de>,
// {
//     #[derive(Deserialize)]
//     #[serde(untagged)]
//     enum StrOrNum {
//         Str(String),
//         Num(u32),
//         // sometimes steam can return larger numbers; add u64 if you want:
//         Num64(u64),
//     }

//     let v = Option::<StrOrNum>::deserialize(deserializer)?;
//     let out = match v {
//         None => None,
//         Some(StrOrNum::Num(n)) => Some(n),
//         Some(StrOrNum::Num64(n)) => Some(u32::try_from(n).map_err(serde::de::Error::custom)?),
//         Some(StrOrNum::Str(s)) => Some(
//             s.parse::<u32>()
//                 .map_err(serde::de::Error::custom)?
//         ),
//     };
//     Ok(out)
// }

// fn de_opt_f32_from_str_or_num<'de, D>(deserializer: D) -> Result<Option<f32>, D::Error>
// where
//     D: Deserializer<'de>,
// {
//     #[derive(Deserialize)]
//     #[serde(untagged)]
//     enum StrOrNum {
//         Str(String),
//         Num(f32),
//         Num64(f64),
//     }

//     let v = Option::<StrOrNum>::deserialize(deserializer)?;
//     let out = match v {
//         None => None,
//         Some(StrOrNum::Num(n)) => Some(n),
//         Some(StrOrNum::Num64(n)) => Some(n as f32),
//         Some(StrOrNum::Str(s)) => Some(
//             s.parse::<f32>()
//                 .map_err(serde::de::Error::custom)?
//         ),
//     };
//     Ok(out)
// }
