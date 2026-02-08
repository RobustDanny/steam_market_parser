use rusqlite::Connection;
use tokio::sync::Mutex;
use chrono::Utc;
use std::{collections::{HashMap, VecDeque}, time::{self, SystemTime, UNIX_EPOCH}};
use steam_market_parser::{
    AdCardHistoryVec, 
    MostRecent, 
    SteamMostRecentResponse, 
    SteamUser, 
    StoreQueueHashmap, 
    UserProfileAds,
    OfferItems,
    OfferContentUpdated,
    CurrentStatusOffer,
    OfferContentToCheck,
    OfferCheckResult,
    DraftItem,
    OfferDraft
};

use uuid::Uuid;

pub struct DataBase{
    connection: Connection,
}

/// One row from offer_log (id, offer_id, round, item_asset_id, item_name, items_price, item_link, time).
pub struct OfferLogRow {
    pub id: i64,
    pub offer_id: String,
    pub round: i64,
    pub item_asset_id: String,
    pub item_name: String,
    pub items_price: String,
    pub item_link: String,
    pub time: String,
}

impl DataBase{
    pub fn connect_to_db()-> DataBase{
        
        let db = DataBase{
            connection: Connection::open("steam_items.db").expect("DB: Cant connect to database"),
        };
        // Set the busy timeout to wait for 5 seconds before throwing the DatabaseBusy error
        db.connection.execute_batch("PRAGMA busy_timeout = 5000;").expect("DB: Failed to set busy timeout");
        db.create_tables();
        db
        
    }
    
    ///Work on price. This is wrong one now
    pub fn db_post_most_recent_items(&self, data: SteamMostRecentResponse) -> (i64, i64) {
        // ID BEFORE inserts
        let mut start_id = self.connection.last_insert_rowid();

        if start_id == 0 {
            start_id = self.connection.query_one("SELECT MAX(id) FROM item_feed", [], |row|{row.get(0)}).expect("DB: Can't get max id from DB");
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
    
            let icon = listing_asset.icon_url.as_ref().expect("DB: No icon_url").to_string();
            let converted_price = match listing.converted_price {
                Some(conv_price) => conv_price.to_string(),
                // None => format!("{:.2}", listing.price * 0.100),
                None => "?".to_string(),
            };
            let game = data.app_data.get(&appid).unwrap().name.to_owned();
            let game_icon = data.app_data.get(&appid).unwrap().icon.to_owned();
            let tradable = listing_asset.tradable.as_ref().expect("DB: No tradable").to_string();
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
            ).expect("DB: Can't insert listing data into DB");
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
                id: row.get(0).expect("DB: Cant get id from DB"),
                listinginfo_id: row.get(1).expect("DB: Cant get listinginfo_id from DB"),
                name: row.get(2).expect("DB: Cant get name from DB"),
                converted_price: row.get(3).expect("DB: Cant get converted_price from DB"),
                game: row.get(4).expect("DB: Cant get game from DB"),
                appid: row.get(5).expect("DB: Cant get appid from DB"),
                market_hash_name: row.get(6).expect("DB: Cant get market_hash_name from DB"),
                tradable: row.get(7).expect("DB: Cant get icon from DB"),
                icon: row.get(8).expect("DB: Cant get icon from DB"),
                game_icon: row.get(9).expect("DB: Cant get game_icon from DB"),
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
        ).expect("DB: Can't insert steam_user data into DB");
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
        ).expect("DB: Can't upsert ad_steam_user data");
        
    }

    pub fn db_get_ad_steam_user(&self)-> VecDeque<UserProfileAds>{
        let mut row_users = self.connection.prepare("SELECT * FROM ad_steam_user")
        .expect("DB: Can't get data from ad_steam_user");

        let vec_ad_users = row_users.query_map([], |row|{
            Ok(UserProfileAds{
                steamid: row.get(1).expect("DB: Can't get steamid from ad_steam_user"),
                nickname: row.get(2).expect("DB: Can't get nickname from ad_steam_user"),
                avatar: row.get(3).expect("DB: Can't get avatar_url_full from ad_steam_user"),
                first_item_image: row.get(4).expect("DB: Can't get first_item_image from ad_steam_user"),
                second_item_image: row.get(5).expect("DB: Can't get second_item_image from ad_steam_user"),
                third_item_image: row.get(6).expect("DB: Can't get third_item_image from ad_steam_user"),
                fourth_item_image: row.get(7).expect("DB: Can't get fourth_item_image from ad_steam_user"),
            })
        }).expect("DB: Query_map on row_users is NOT successful");

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
                steamid: row.get(1).expect("DB: Cant get steamid from DB"),
                nickname: row.get(2).expect("DB: Cant get nickname from DB"),
                avatar: row.get(3).expect("DB: Cant get avatar from DB"),
                first_item_image: row.get(4).expect("DB: Cant get first_item_image from DB"),
                second_item_image: row.get(5).expect("DB: Cant get second_item_image from DB"),
                third_item_image: row.get(6).expect("DB: Cant get third_item_image from DB"),
                fourth_item_image: row.get(7).expect("DB: Cant get fourth_item_image from DB"),
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
        ).expect("DB: Cant update steam_user status");

    }

    pub fn db_fill_store_hashmap(&self, mut store_hashmap: StoreQueueHashmap)->Result<StoreQueueHashmap, rusqlite::Error>{
        let mut query = self.connection.prepare("
            SELECT * FROM steam_user
        ").expect("DB: Cant get all steam_userS");

        let rows = query.query_map([], |row|{
            let steamid: String = row.get(1).expect("DB: Can't get steamid from steam_user");
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
            ).expect("DB: Can't get uuid while db retrival");

            let result: Result<Vec<_>, _> = query.query_map([&generated_uuid], |row| {
                Ok(row.get::<_, String>(0).expect("DB: Cant get offer_id from DB"))
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
                offer_id, buyer_steamid, trader_steamid, count, price, accepted,
                paid, status, created, last_update
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(offer_id) DO NOTHING
            ",

            [
                &generated_uuid,
                &buyer,
                &trader,
                &"0".to_string(),
                &"0".to_string(),
                &false.to_string(),
                &false.to_string(),
                &"IN PROCESS".to_string(),
                &time,
                &time,
            ],
        ).expect("DB: Can't upsert offer data");

        self.connection.execute(
            "INSERT INTO offer_log (
                offer_id, round, item_asset_id, item_contextid, item_appid, item_name, items_price, item_link, item_image, time
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ",

            [
                &generated_uuid,
                &"0".to_string(),
                &"Nope".to_string(),
                &"Nope".to_string(),
                &"Nope".to_string(),
                &"Nope".to_string(),
                &"Nope".to_string(),
                &"Nope".to_string(),
                &"Nope".to_string(),
                &time,
            ],
        ).expect("DB: Can't upsert offer data");

        generated_uuid.to_string()
    }

    pub fn db_offer_update_offer(&self, offer_id: String, items: Vec<OfferItems>) -> OfferContentUpdated{

        let mut result = OfferContentUpdated {
            offer_id: offer_id.clone(),
            total_price: 0.0,
            total_count: 0,
            new_items:  Vec::new(),
            added_items:  Vec::new(),
            removed_items:  Vec::new(),
            updated_items:  Vec::new(),
        }; 
        
        let round: i64 = self.connection.query_row(
            "SELECT COALESCE(MAX(round), 0) FROM offer_log WHERE offer_id = ?1",
            [&offer_id],
            |row| row.get(0),
        ).expect("DB: Can't get round from offer_log");        

        //Get previous offer
        let mut previous_offer_stmt = self.connection.prepare("
            SELECT * FROM offer_log WHERE offer_id = ?1 AND round = ?2
            ").expect("DB: tried to get previous_offer from offer_log");

        let previous_offer: Vec<OfferItems> = previous_offer_stmt.query_map([&offer_id, &round.to_string()], |row|{
            Ok(OfferItems {
                item_asset_id: row.get(3)?,
                item_contextid: row.get(4)?,
                item_appid: row.get(5)?,
                item_name: row.get(6)?,
                item_price: row.get(7)?,
                item_link: row.get(8)?,
                item_image: row.get(9)?,
            }
        )
        }).expect("DB: query_map previous_offer").collect::<Result<Vec<_>, _>>().expect("DB: failed to collect previous_offer from offer_log");

        //------------------

        //add removed items into result

        let mut this_offer_hashmap: HashMap<String, bool> = HashMap::new();

        for item in &items{
            this_offer_hashmap.insert(item.item_asset_id.clone(), true);
        }

        for item in &previous_offer{
            match this_offer_hashmap.get(&item.item_asset_id){
                None if item.item_price != "Nope" => result.removed_items.push(item.clone()),
                Some(_) => {}
                None => {}
            }
        }

        //------------------

        let mut total_price: f64 = 0.0;
        let mut total_count = 0;

        let time = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        for item in items{
            total_count = total_count + 1;
            total_price = total_price + item.item_price.parse::<f64>().unwrap_or(0.0);

            result = self.db_offer_checking_offer_item(result, &item, &round.to_string(), &offer_id);

            self.connection.execute(
                "INSERT INTO offer_log (
                    offer_id, round, item_asset_id, item_contextid, item_appid, item_name, items_price, item_link, item_image, time
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                ",
    
                [
                    &offer_id,
                    &(round + 1).to_string(),
                    &item.item_asset_id,
                    &item.item_contextid,
                    &item.item_appid,
                    &item.item_name,
                    &item.item_price,
                    &item.item_link,
                    &item.item_image,
                    &time,
                ],
            ).expect("DB: Can't upsert offer_log data");
        }

        self.connection.execute(
            "UPDATE offer
             SET price = ?1,
                 count = ?2
             WHERE offer_id = ?3",
            [
                &total_price.to_string(),
                &total_count.to_string(),
                &offer_id,
            ],
        ).expect("DB: Can't update offer data");
        
        result.total_price = total_price;
        result.total_count = total_count;
        // println!("{result:#?}");
        result
    }

    fn db_offer_checking_offer_item(&self, mut result: OfferContentUpdated, item: &OfferItems, round: &String, offer_id: &String)-> OfferContentUpdated{

        result.new_items.push(item.clone());

        let item_quary = self.connection.query_one("
        SELECT * FROM offer_log WHERE item_asset_id = ?1 AND round = ?2 AND offer_id = ?3
        ", [
            item.item_asset_id.clone(), 
            round.clone(), 
            offer_id.clone()],
         |row| -> Result<OfferLogRow, rusqlite::Error> {
            Ok(OfferLogRow {
                id: row.get(0)?,
                offer_id: row.get(1)?,
                round: row.get(2)?,
                item_asset_id: row.get(3)?,
                item_name: row.get(4)?,
                items_price: row.get(5)?,
                item_link: row.get(6)?,
                time: row.get(7)?,
            })
         });

        match item_quary {
            Err(_) => result.added_items.push(item.clone()),
            Ok(row) if row.items_price != item.item_price => result.updated_items.push(item.clone()),
            Ok(_) => {}
        }

        result
    }

    pub fn db_offer_update_status_offer(&self, status_and_offer_id: CurrentStatusOffer){

        let offer_id = status_and_offer_id.offer_id;
        let status = status_and_offer_id.status;

        let mut accepted = false;
        let mut paid = false;

        match status.as_str() {
            "ACCEPTED" => {
                accepted = true;
                paid = false;
            },
            "IN PROCESS" => {
                accepted = false;
                paid = false;
            },
            "PAY PROCESS" | "SUCCESS" => {
                accepted = true;
                paid = true;
            }
            _ => {}
        }

        self.connection.execute(
            "UPDATE offer
             SET paid = ?1,
                 accepted = ?2,
                 status = ?3
             WHERE offer_id = ?4",
            (&paid, &accepted, &status, &offer_id),
        ).expect("DB: Can't update offer data");

    }

    pub fn db_offer_check_offer_to_pay(&self, items_and_offer_id: OfferContentToCheck)-> OfferCheckResult{
        // println!("items_and_offer_id {items_and_offer_id:#?}");
        let offer_id = items_and_offer_id.offer_id;
        let offer_to_check = items_and_offer_id.special_for_save_offer;
        let partner_steam_id = items_and_offer_id.partner_steam_id;

        let round: i64 = self.connection.query_row(
            "SELECT COALESCE(MAX(round), 0) FROM offer_log WHERE offer_id = ?1",
            [&offer_id],
            |row| row.get(0),
        ).expect("DB: Can't get round from offer_log");     

        let mut last_offer = self.connection.prepare("
            SELECT * FROM offer_log WHERE offer_id = ?1 AND round = ?2
            ").expect("DB: tried to get previous_offer from offer_log");

        let last_offer: Vec<OfferItems> = last_offer.query_map([&offer_id, &round.to_string()], |row|{
            Ok(OfferItems {
                item_asset_id: row.get(3)?,
                item_contextid: row.get(4)?,
                item_appid: row.get(5)?,
                item_name: row.get(6)?,
                item_price: row.get(7)?,
                item_link: row.get(8)?,
                item_image: row.get(9)?,
            }
        )
        }).expect("DB: query_map previous_offer").collect::<Result<Vec<_>, _>>().expect("DB: failed to collect previous_offer from offer_log");

        println!("last_offer {last_offer:#?}");
        println!("offer_to_check {offer_to_check:#?}");

        if offer_to_check == last_offer {

            let partner_trade_url= self.db_account_get_trade_url(partner_steam_id);

            println!("Offers match");
            OfferCheckResult{
                offer_id,
                check_result: true,
                offer_items: offer_to_check,
                partner_trade_url,
            }
            
        } else {
            println!("Offer changed");
            OfferCheckResult{
                offer_id,
                check_result: false,
                offer_items: Vec::new(),
                partner_trade_url: String::from(""),
            }
        }
    }

    pub fn db_account_post_trade_url(&self, steam_id: &String, trade_url: &String){

        self.connection
        .execute(
            "UPDATE steam_user
             SET trade_url = ?1
             WHERE steamid = ?2",
            [
                &trade_url,
                &steam_id,
            ],
        )
        .expect("DB: Can't add trade_url to steam_user");

    }

    pub fn db_account_get_trade_url(&self, steam_id: String)-> String{

        let trade_url = self.connection
        .query_one(
            "
            SELECT trade_url FROM steam_user
            WHERE steamid = ?1
            ",
            [
                &steam_id,
            ],
            |row| row.get(0),
        )
        .expect("DB: Can't get trade_url from steam_user");

    trade_url
    }

    pub fn db_create_offer_draft(
        &mut self,
        offer_id: &str,
        partner_trade_url: &str,
        autosend: bool,
        give_items: Vec<DraftItem>,
    ) -> Result<String, rusqlite::Error> {
        let draft_id = Uuid::new_v4().to_string();
        let created_at = Utc::now().timestamp();

        let tx = self.connection.transaction()?;

        tx.execute(
            "INSERT INTO trade_offer_drafts (draft_id, offer_id, partner_trade_url, autosend, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                draft_id,
                offer_id,
                partner_trade_url,
                if autosend { 1 } else { 0 },
                created_at
            ],
        )?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO trade_offer_draft_items (draft_id, appid, contextid, assetid, amount, side)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'give')"
            )?;

            for it in give_items {
                stmt.execute(rusqlite::params![
                    draft_id,
                    it.appid as i64,
                    it.contextid,
                    it.assetid,
                    it.amount as i64
                ])?;
            }
        }

        tx.commit()?;
        Ok(draft_id)
    }

    pub fn db_get_offer_draft(&self, draft_id: &str) -> Result<OfferDraft, rusqlite::Error> {
        // read autosend (optional, but useful)
        let autosend: i64 = self.connection.query_row(
            "SELECT autosend FROM trade_offer_drafts WHERE draft_id = ?1",
            rusqlite::params![draft_id],
            |row| row.get(0),
        )?;

        let mut stmt = self.connection.prepare(
            "SELECT appid, contextid, assetid, amount
             FROM trade_offer_draft_items
             WHERE draft_id = ?1 AND side = 'give'
             ORDER BY id ASC"
        )?;

        let give_iter = stmt.query_map(rusqlite::params![draft_id], |row| {
            Ok(DraftItem {
                appid: row.get::<_, i64>(0)? as u32,
                contextid: row.get(1)?,
                assetid: row.get(2)?,
                amount: row.get::<_, i64>(3)? as u32,
            })
        })?;

        let mut give = Vec::new();
        for it in give_iter {
            give.push(it?);
        }

        Ok(OfferDraft {
            give,
            autosend: autosend == 1,
        })
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
                trade_url TEXT,
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
                count TEXT,
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
                item_asset_id TEXT,
                item_contextid TEXT,
                item_appid TEXT,
                item_name TEXT,
                items_price TEXT,
                item_link TEXT,
                item_image TEXT,
                time TEXT,
                FOREIGN KEY (offer_id) REFERENCES offer(offer_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS trade_offer_drafts (
                draft_id TEXT PRIMARY KEY,
                offer_id TEXT NOT NULL,
                partner_trade_url TEXT NOT NULL,
                autosend INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS trade_offer_draft_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id TEXT NOT NULL,
                appid INTEGER NOT NULL,
                contextid TEXT NOT NULL,
                assetid TEXT NOT NULL,
                amount INTEGER NOT NULL DEFAULT 1,
                side TEXT NOT NULL DEFAULT 'give',  -- 'give' now, later could add 'receive'
                FOREIGN KEY(draft_id) REFERENCES trade_offer_drafts(draft_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_draft_items_draft_id ON trade_offer_draft_items(draft_id);


        ").expect("DB: Failed to create tables");
    }
}
