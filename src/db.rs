use rusqlite::Connection;

use steam_market_parser::{SteamMostRecentResponse, MostRecent, SteamUser};

pub struct DataBase{
    connection: Connection,
}

impl DataBase{
    pub fn connect_to_db()-> DataBase{
        
        let db = DataBase{
            connection: Connection::open("steam_items.db").expect("Cant connect to database"),
        };
        Self::create_tables(&db);
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
            let price = format!("{:.2}", listing.price * 0.100);
            let game = data.app_data.get(&appid).unwrap().name.to_owned();
            let game_icon = data.app_data.get(&appid).unwrap().icon.to_owned();
            let tradable = listing_asset.tradable.as_ref().expect("No tradable").to_string();
            let name = listing_asset.market_name.as_ref().unwrap().trim().to_string();
            let market_hash_name = listing_asset.market_hash_name.as_ref().unwrap().trim().to_string();
    
            self.connection.execute(
                "INSERT OR IGNORE INTO item_feed 
                (listinginfo_id, name, price, game, appid, icon_url, game_icon, market_hash_name, tradable) 
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                [
                    listinginfo_id, name, price, game, appid, icon,
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
            "SELECT id, listinginfo_id, name, price, game, appid, 
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
                price: row.get(3).expect("Cant get price from DB"),
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

    pub fn db_add_steam_user(&self, steam_user: &SteamUser){

        println!("{steam_user:#?}");

        self.connection.execute(
            "INSERT OR IGNORE INTO steam_user 
            (steamid, nickname, avatar_url_small, avatar_url_full) 
            VALUES (?1, ?2, ?3, ?4)",
            [
                &steam_user.steamid, &steam_user.nickname, &steam_user.avatar_url_small, &steam_user.avatar_url_full
            ],
        ).expect("Can't insert steam_user data into DB");
    }
    fn create_tables(&self) {
        self.connection.execute_batch("
            CREATE TABLE IF NOT EXISTS item_feed (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                listinginfo_id TEXT UNIQUE,
                name TEXT,
                price TEXT,
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
                avatar_url_full TEXT
            );
        ").expect("Failed to create tables");
    }
}