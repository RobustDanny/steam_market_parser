use actix_web_actors::ws;
use actix_web::{Error, HttpRequest, Result, HttpResponse, web};
use actix::prelude::*;

use steam_market_parser::{
    ChatQuery,
};

use crate::{
    NotificationState,
};

#[derive(serde::Serialize, Clone)]
pub struct ChatSessionPlayload {
    buyer_steamid: String,
    trader_steamid: String,
}

#[derive(serde::Serialize, Clone)]
pub struct NotificationPlayload {
    steamid_to_get_notification: String,
}

struct NotificationWSActor {
    state: web::Data<NotificationState>,
}

struct BroadcastNotification(NotificationPlayload);

impl Message for BroadcastNotification {
    type Result = ();
}

impl Actor for NotificationWSActor {
    type Context = ws::WebsocketContext<Self>;
    
    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to broadcast channel and forward updates via actor messages
        let mut rx = self.state.notification_broadcaster.subscribe();
        let addr = ctx.address();

        tokio::spawn(async move {
            while let Ok(payload) = rx.recv().await {
                let _ = addr.do_send(BroadcastNotification(payload));
            }
        });
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for NotificationWSActor {
    fn handle(&mut self, _msg: Result<ws::Message, ws::ProtocolError>, _ctx: &mut Self::Context) {
        // Handle incoming WebSocket messages if needed
    }
}

impl Handler<BroadcastNotification> for NotificationWSActor {
    type Result = ();

    fn handle(&mut self, msg: BroadcastNotification, ctx: &mut Self::Context) {
        let payload = msg.0;
        
        if let Ok(json) = serde_json::to_string(&payload) {
            ctx.text(json);
        }
    }
}

impl Actor for ChatSessionPlayload {
    type Context = ws::WebsocketContext<Self>;
    
    fn started(&mut self, _: &mut Self::Context) {
        println!("Chat session started between {} and {}", self.buyer_steamid, self.trader_steamid);
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        println!("Chat session ended between {} and {}", self.buyer_steamid, self.trader_steamid);
    }

}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ChatSessionPlayload
 {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Text(text)) => {
                println!("Received message: {}", text);

                // Send a response back to the other user (buyer or trader)
                let response = format!("Message received: {}", text);
                ctx.text(response);
            }
            Ok(ws::Message::Close(_)) => {
                // Handle WebSocket close event if necessary
                println!("WebSocket closed between {} and {}", self.buyer_steamid, self.trader_steamid);
                ctx.close(None); // Optional: you can send a close code here
            }
            Ok(ws::Message::Ping(ping)) => {
                // Respond to ping message
                ctx.pong(&ping); // Respond with a pong
            }
            Ok(ws::Message::Pong(_)) => {
                // Handle pong message if necessary
                println!("Received pong");
            }
            Err(e) => {
                // Handle any errors
                println!("Error received: {}", e);
                // ctx.close(Some(1002)); // Optional: Close with a specific WebSocket error code
            }
            _ => (),
        }
    }
}

pub async fn ws_chat_handler(
    req: HttpRequest,
    stream: web::Payload,
    query: web::Query<ChatQuery>,
) -> Result<HttpResponse, Error> {
    let buyer_steamid = query.buyer.clone();
    let trader_steamid = query.trader.clone();

    let session = ChatSessionPlayload {
        buyer_steamid: buyer_steamid.clone(),
        trader_steamid: trader_steamid.clone(),
    };

    ws::start(session, &req, stream)
}

pub async fn ws_notification_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<NotificationState>,
) -> Result<HttpResponse, Error> {

    let ws_notification = NotificationWSActor {
        state: state.clone(),
    };

    ws::start(ws_notification, &req, stream)
}