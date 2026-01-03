use actix_web::{web};
use std::time::Duration;
use tokio::sync::{broadcast, mpsc};

use crate::{
    UserAdState,
    FeedItemsState,
    SteamMostRecentResponse,
};

use crate::db::DataBase;

use crate::websocket::{
    AdsBroadcastPayload,
    BroadcastPayload
};

pub async fn tokio_user_ad_loop(state: web::Data<UserAdState>){
    loop {
        let mut ads = state.user_ads.lock().await;

        if let Some(pop) = ads.queue.pop_front() {
            ads.queue.push_back(pop);
        }
        
        let playload = AdsBroadcastPayload{
            user_ads: ads.queue.clone(),
        };

        let _ = state.ads_broadcaster.send(playload);

        drop(ads);
        tokio::time::sleep(Duration::from_secs(10)).await;
    }
}

pub async fn tokio_receiver_most_recent_items_request(
    mut receiver: mpsc::Receiver<SteamMostRecentResponse>,
    db: DataBase,
    state: web::Data<FeedItemsState>,
) {
    while let Some(most_recent_items_response) = receiver.recv().await {
        let (start_id, end_id) = db.db_post_most_recent_items(most_recent_items_response);

        if let Ok(result) = db.db_get_most_recent_items(start_id, end_id) {
            {
                let mut items = state.items.lock().await;
                *items = result.clone();
            }
            let payload = BroadcastPayload {
                items: result.clone(),
            };
            let _ = state.broadcaster.send(payload);
        }
    }
}