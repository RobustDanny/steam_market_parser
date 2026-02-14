use actix_web::{web};
use std::time::Duration;
use tokio::sync::{broadcast, mpsc};

use crate::{
    UserAdState,
    FeedItemsState,
    SteamMostRecentResponse,
    GameListState
};

use crate::db::DataBase;
use crate::payments::stripe::payment::create_transfer;

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
        tokio::time::sleep(Duration::from_secs(4)).await;
    }
}

pub async fn tokio_db_update_game_list(game_list: web::Data<GameListState>){
    loop {
        
        let db = DataBase::connect_to_db();

        let list = match db.db_update_game_list() {
            Ok(vec) => vec,
            Err(e) => {
                eprintln!("db_update_game_list failed: {e}");
                tokio::time::sleep(Duration::from_secs(10)).await;
                continue;
            }
        };

        println!("List {list:#?}");
        {
            let mut game_list_guard = game_list.game_list.lock().await;
            *game_list_guard = list;
        }

        drop(db);
        tokio::time::sleep(Duration::from_secs(86400)).await;
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

pub async fn tokio_db_check_transaction_availability() {
    loop {
        println!("Checking stripe_wallet availability + transfers");

        let stripe_key = match std::env::var("STRIPE_SECRET_KEY") {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Missing STRIPE_SECRET_KEY: {e}");
                tokio::time::sleep(Duration::from_secs(60)).await;
                continue;
            }
        };
        let client = stripe::Client::new(stripe_key);

        let db = DataBase::connect_to_db();

        // 1) unlock matured credits
        db.db_check_stripe_wallet_transaction_availability();

        // 2) transfer available credits
        let rows = match db.db_get_stripe_wallet_available(50) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("db_get_stripe_wallet_available failed: {e}");
                drop(db);
                tokio::time::sleep(Duration::from_secs(600)).await;
                continue;
            }
        };

        for (row_id, seller_acct, offer_id, amount_cents) in rows {
            // guard
            if !seller_acct.starts_with("acct_") {
                eprintln!("stripe_wallet row_id={row_id} has non-acct stripe_id={seller_acct}");
                continue;
            }

            match create_transfer(&client, &seller_acct, amount_cents, &offer_id).await {
                Ok(tr) => {
                    if let Err(e) = db.db_mark_stripe_wallet_transferred(row_id, tr.id.as_str()) {
                        eprintln!("db_mark_stripe_wallet_transferred failed row_id={row_id}: {e}");
                    } else {
                        println!("Transferred row_id={row_id} offer_id={offer_id} -> {seller_acct} transfer={}", tr.id);
                    }
                }
                Err(e) => {
                    eprintln!("Stripe transfer failed row_id={row_id} offer_id={offer_id}: {e}");
                    // Don't mark transferred; it will retry next loop.
                }
            }
        }

        drop(db);
        tokio::time::sleep(Duration::from_secs(600)).await; // 10 min
    }
}