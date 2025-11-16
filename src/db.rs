use rusqlite::Connection;
use steam_market_parser::SteamMostRecentResponse;

#[derive(Debug)]
pub struct MostRecent{
    last_listing: String,
}
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
    
    pub fn db_post_most_recent_items(&self, data: SteamMostRecentResponse) {
        self.connection.execute("INSERT INTO items (last_listing) VALUES (?1)", [data.last_listing]).unwrap();
    }

    pub fn db_get_most_recent_items(&self) -> Result<Vec<MostRecent>, rusqlite::Error>{
        let mut query = self.connection.prepare("SELECT * FROM items").unwrap();

        let result = query.query_map([], |row| {
            Ok(MostRecent{
                last_listing: row.get(1).unwrap(),
            })
        })?.collect();

        result
    }

    fn create_tables(&self) {
        self.connection.execute_batch("
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                last_listing TEXT
            );
        ").expect("Failed to create tables");
    }
}