use rusqlite::Connection;
use tokio::sync::Mutex;
use chrono::Utc;
use std::{collections::VecDeque, time::{self, SystemTime, UNIX_EPOCH}};
use steam_market_parser::{
    AdCardHistoryVec, 
    MostRecent, 
    SteamMostRecentResponse, 
    SteamUser, 
    StoreQueueHashmap, 
    UserProfileAds
};

use uuid::Uuid;

pub struct DataBase{
    connection: Connection,
}

impl DataBase{
    pub fn connect_to_db()-> DataBase{
        
        let db = DataBase{
            connection: Connection::open("steam_items.db").expect("Cant connect to database"),
        };
        // Set the busy timeout to wait for 5 seconds before throwing the DatabaseBusy error
        db.connection.execute_batch("PRAGMA busy_timeout = 5000;").expect("Failed to set busy timeout");
        db.create_tables();
        db
        
    }
    
    ///Work on price. This is wrong one now
    pub fn db_post_most_recent_items(&self, data: SteamMostRecentResponse) -> (i64, i64) {
        // ID BEFORE inserts
        let mut start_id = self.connection.last_insert_rowid();

        if start_id == 0 {
            start_id = self.connection.query_one("SELECT MAX(id) FROM item_feed", [], |row|{row.get(0)}).expect("Can't get max id from DB");
        }
    
        for listing in data.listinginfo.values() {
            let listinginfo_id = listing.listingid.to_string();
            let appid = listing.asset.appid.to_string();
            let contextid = listing.asset.contextid.to_string();
            let assetid = listing.asset.id.to_string();
    
            let listing_asset = data.assets
                .get(&appid).unwrap()
                .get(&contextid).unwrap()
                .get(&assetid).unwrap();
    
            let icon = listing_asset.icon_url.as_ref().expect("No icon_url").to_string();
            let converted_price = match listing.converted_price {
                Some(conv_price) => conv_price.to_string(),
                None => format!("{:.2}", listing.price * 0.100),
            };
            let game = data.app_data.get(&appid).unwrap().name.to_owned();
            let game_icon = data.app_data.get(&appid).unwrap().icon.to_owned();
            let tradable = listing_asset.tradable.as_ref().expect("No tradable").to_string();
            let name = listing_asset.market_name.as_ref().unwrap().trim().to_string();
            let market_hash_name = listing_asset.market_hash_name.as_ref().unwrap().trim().to_string();
    
            self.connection.execute(
                "INSERT OR IGNORE INTO item_feed 
                (listinginfo_id, name, converted_price, game, appid, icon_url, game_icon, market_hash_name, tradable) 
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                [
                    listinginfo_id, name, converted_price, game, appid, icon,
                    game_icon, market_hash_name, tradable,
                ],
            ).expect("Can't insert listing data into DB");
        }
    
        // ID AFTER inserts
        let end_id = self.connection.last_insert_rowid();
    
        (start_id, end_id)
    }

    pub fn db_get_most_recent_items(
        &self,
        start_id: i64,
        end_id: i64
    ) -> Result<Vec<MostRecent>, rusqlite::Error> {

        let mut query = self.connection.prepare(
            "SELECT id, listinginfo_id, name, converted_price, game, appid, 
                    market_hash_name, tradable, icon_url, game_icon
             FROM item_feed
             WHERE id > ?1 AND id <= ?2
             ORDER BY id"
        )?;

        // println!("{:#?}", query);

        let result = query.query_map([start_id, end_id], |row| {
            Ok(MostRecent{
                id: row.get(0).expect("Cant get id from DB"),
                listinginfo_id: row.get(1).expect("Cant get listinginfo_id from DB"),
                name: row.get(2).expect("Cant get name from DB"),
                converted_price: row.get(3).expect("Cant get converted_price from DB"),
                game: row.get(4).expect("Cant get game from DB"),
                appid: row.get(5).expect("Cant get appid from DB"),
                market_hash_name: row.get(6).expect("Cant get market_hash_name from DB"),
                tradable: row.get(7).expect("Cant get icon from DB"),
                icon: row.get(8).expect("Cant get icon from DB"),
                game_icon: row.get(9).expect("Cant get game_icon from DB"),
            })
        })?.collect();

        result
    }

    ///Check whats an excluded meaning
    pub fn db_add_steam_user(&self, steam_user: &SteamUser){

        println!("{steam_user:#?}");

        self.connection.execute(
            "INSERT OR IGNORE INTO steam_user 
            (steamid, nickname, avatar_url_small, avatar_url_full, status) 
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(steamid) DO UPDATE SET
                steamid = excluded.steamid,
                nickname = excluded.nickname,
                avatar_url_small = excluded.avatar_url_small,
                avatar_url_full = excluded.avatar_url_full,
                status = excluded.status;
                ",
            [
                &steam_user.steamid, &steam_user.nickname, &steam_user.avatar_url_small, &steam_user.avatar_url_full,
                &steam_user.status
            ],
        ).expect("Can't insert steam_user data into DB");
    }
    
    pub fn db_add_ad_steam_user(&self, steam_user: &UserProfileAds){
        self.connection.execute(
            "INSERT INTO ad_steam_user (
                steamid, nickname, avatar_url_full,
                first_item_image, second_item_image,
                third_item_image, fourth_item_image
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(steamid) DO UPDATE SET
                nickname = excluded.nickname,
                avatar_url_full = excluded.avatar_url_full,
                first_item_image = excluded.first_item_image,
                second_item_image = excluded.second_item_image,
                third_item_image = excluded.third_item_image,
                fourth_item_image = excluded.fourth_item_image;",

            [
                &steam_user.steamid,
                &steam_user.nickname,
                &steam_user.avatar,
                &steam_user.first_item_image,
                &steam_user.second_item_image,
                &steam_user.third_item_image,
                &steam_user.fourth_item_image,
            ],
        ).expect("Can't upsert ad_steam_user data");
        
    }

    pub fn db_get_ad_steam_user(&self)-> VecDeque<UserProfileAds>{
        let mut row_users = self.connection.prepare("SELECT * FROM ad_steam_user")
        .expect("Can't get data from ad_steam_user");

        let vec_ad_users = row_users.query_map([], |row|{
            Ok(UserProfileAds{
                steamid: row.get(1).expect("Can't get steamid from ad_steam_user"),
                nickname: row.get(2).expect("Can't get nickname from ad_steam_user"),
                avatar: row.get(3).expect("Can't get avatar_url_full from ad_steam_user"),
                first_item_image: row.get(4).expect("Can't get first_item_image from ad_steam_user"),
                second_item_image: row.get(5).expect("Can't get second_item_image from ad_steam_user"),
                third_item_image: row.get(6).expect("Can't get third_item_image from ad_steam_user"),
                fourth_item_image: row.get(7).expect("Can't get fourth_item_image from ad_steam_user"),
            })
        }).expect("Query_map on row_users is NOT successful");

        let mut queue = VecDeque::new();

        for user in vec_ad_users {
            if let Ok(u) = user {
                queue.push_back(u);
            }
        }

        queue
    }

    pub fn db_get_ad_cards_history(&self, steamid: String)-> Result<AdCardHistoryVec, rusqlite::Error>{
        let mut query = self.connection.prepare("SELECT * FROM ad_steam_user WHERE steamid=?1")?;

        let rows = query.query_map([steamid], |row| {
            Ok(UserProfileAds{
                steamid: row.get(1).expect("Cant get steamid from DB"),
                nickname: row.get(2).expect("Cant get nickname from DB"),
                avatar: row.get(3).expect("Cant get avatar from DB"),
                first_item_image: row.get(4).expect("Cant get first_item_image from DB"),
                second_item_image: row.get(5).expect("Cant get second_item_image from DB"),
                third_item_image: row.get(6).expect("Cant get third_item_image from DB"),
                fourth_item_image: row.get(7).expect("Cant get fourth_item_image from DB"),
            })
        })?;

        let mut result = Vec::new();

        for row in rows{
            result.push(row?);
        }

        Ok(AdCardHistoryVec{
            ad_card_vec: result
        })

    }

    pub fn db_change_user_status(&self, session: SteamUser){

        let steamid = session.steamid;

        self.connection.execute(
            "UPDATE steam_user 
             SET status = ?1
             WHERE steamid = ?2",
            ("offline".to_string(), steamid),
        ).expect("Cant update steam_user status");

    }

    pub fn db_fill_store_hashmap(&self, mut store_hashmap: StoreQueueHashmap)->Result<StoreQueueHashmap, rusqlite::Error>{
        let mut query = self.connection.prepare("
            SELECT * FROM steam_user
        ").expect("Cant get all steam_userS");

        let rows = query.query_map([], |row|{
            let steamid: String = row.get(1).expect("Can't get steamid from steam_user");
            store_hashmap.hashmap.entry(steamid).or_insert_with(|| Mutex::new(VecDeque::new()));
            Ok(())
        })?;

        // Consume the iterator to execute the query
        for row in rows {
            row?;
        }

        Ok(store_hashmap)
    }

    pub fn db_offer_make_offer(&self, buyer: String, trader: String) -> String{
        let time = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        let mut generated_uuid = Uuid::new_v4().to_string();
        loop{

            let mut query = self.connection.prepare("
             SELECT offer_id
             FROM offer
             WHERE offer_id = ?1"
            ).expect("Can't get uuid while db retrival");

            let result: Result<Vec<_>, _> = query.query_map([&generated_uuid], |row| {
                Ok(row.get::<_, String>(0).expect("Cant get offer_id from DB"))
            }).map(|iter| iter.collect());
            
            if let Ok(rows) = result {
                if rows.is_empty() {
                    break;
                }
            } else {
                break;
            }
            
            generated_uuid = Uuid::new_v4().to_string();
        }

        self.connection.execute(
            "INSERT INTO offer (
                offer_id, buyer_steamid, trader_steamid, price, accepted,
                paid, status, created, last_update
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(offer_id) DO NOTHING
            ",

            [
                &generated_uuid,
                &buyer,
                &trader,
                &"0".to_string(),
                &false.to_string(),
                &false.to_string(),
                &"IN PROCESS".to_string(),
                &time,
                &time,
            ],
        ).expect("Can't upsert offer data");

        generated_uuid.to_string()
    }

    fn create_tables(&self) {
        self.connection.execute_batch("
            CREATE TABLE IF NOT EXISTS item_feed (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                listinginfo_id TEXT UNIQUE,
                name TEXT,
                converted_price TEXT,
                game TEXT,
                appid TEXT,
                market_hash_name TEXT,
                tradable TEXT,
                icon_url TEXT,
                game_icon TEXT
            );
            CREATE TABLE IF NOT EXISTS steam_user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                steamid TEXT UNIQUE,
                nickname TEXT,
                avatar_url_small TEXT,
                avatar_url_full TEXT,
                status TEXT
            );
            CREATE TABLE IF NOT EXISTS ad_steam_user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                steamid TEXT UNIQUE,
                nickname TEXT,
                avatar_url_full TEXT,
                first_item_image TEXT,
                second_item_image TEXT,
                third_item_image TEXT,
                fourth_item_image TEXT
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT,
                buyer_steamid TEXT,
                trader_steamid TEXT,
                message_type TEXT,
                message TEXT,
                data TEXT
            );
            CREATE TABLE IF NOT EXISTS offer (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                offer_id TEXT UNIQUE,
                buyer_steamid TEXT,
                trader_steamid TEXT,
                price TEXT,
                accepted BOOLEAN,
                paid BOOLEAN,
                status TEXT,
                created TEXT,
                last_update TEXT
            );

            CREATE TABLE IF NOT EXISTS offer_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                offer_id TEXT,
                round INTEGER,
                item_name TEXT,
                items_price TEXT,
                FOREIGN KEY (offer_id) REFERENCES offer(id) ON DELETE CASCADE
            );

        ").expect("Failed to create tables");
    }
}