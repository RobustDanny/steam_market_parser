
use std::sync::mpsc;

use crate::db::DataBase;
use crate::SteamMostRecentResponse;

pub async fn tokio_receiver(mut rx: mpsc::Receiver<SteamMostRecentResponse>, db: DataBase, 
    // sender: Sender<Vec<MostRecent>>
){
    while let Some(most_recent_items_response) = rx.recv().await {

        db.db_post_most_recent_items(most_recent_items_response);
        let result = db.db_get_most_recent_items().unwrap();
        // sender.send(result);

        
        println!("got dammit= {result:#?}");
    }
}

