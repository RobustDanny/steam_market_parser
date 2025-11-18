use rusqlite::Connection;

use steam_market_parser::{SteamMostRecentResponse, MostRecent};

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
    pub fn db_post_most_recent_items(&self, data: SteamMostRecentResponse){
        // println!("Length: {}", data.listinginfo.len());
        for listing in data.listinginfo.values(){
            let appid = listing.asset.appid.to_string();
            let contextid = listing.asset.contextid.to_string();
            let assetid = listing.asset.id.to_string();
            let listing_asset = data.assets.get(&appid).unwrap().get(&contextid).unwrap().get(&assetid).unwrap();
            let icon = listing_asset.icon_url.as_ref().expect("No icon_url").to_string();
            let price = format!("{:.2}", listing.price * 0.100);
            let game = data.app_data.get(&appid).unwrap().name.to_owned();
            let game_icon = data.app_data.get(&appid).unwrap().icon.to_owned();
            let tradable = listing_asset.tradable.as_ref().expect("No tradable field").to_string();
            let name = listing_asset.market_name.as_ref().unwrap().trim().to_string();
            let market_hash_name = listing_asset.market_hash_name.as_ref().unwrap().trim().to_string();

            self.connection.execute("INSERT INTO items (name, price, game, appid, icon_url, game_icon, market_hash_name, tradable) 
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
             [name, price, game, appid, icon, game_icon, market_hash_name, tradable]).expect("Can't insert listing data into DB");
        }
    }

    pub fn db_get_most_recent_items(&self) -> Result<Vec<MostRecent>, rusqlite::Error>{
        let mut query = self.connection.prepare("SELECT * FROM items ORDER BY id DESC LIMIT 10")
        .expect("Cant make sql query SELECT");

        let result = query.query_map([], |row| {
            Ok(MostRecent{
                id: row.get(0).expect("Cant get id from DB"),
                name: row.get(1).expect("Cant get name from DB"),
                price: row.get(2).expect("Cant get price from DB"),
                game: row.get(3).expect("Cant get game from DB"),
                appid: row.get(4).expect("Cant get appid from DB"),
                market_hash_name: row.get(5).expect("Cant get market_hash_name from DB"),
                tradable: row.get(6).expect("Cant get icon from DB"),
                icon: row.get(7).expect("Cant get icon from DB"),
                game_icon: row.get(8).expect("Cant get game_icon from DB"),
            })
        })?.collect();

        result
    }

    fn create_tables(&self) {
        self.connection.execute_batch("
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                price TEXT,
                game TEXT,
                appid TEXT,
                market_hash_name TEXT,
                tradable TEXT,
                icon_url TEXT,
                game_icon TEXT
            );
        ").expect("Failed to create tables");
    }
}