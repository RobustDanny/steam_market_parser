use actix_web_actors::ws;
use actix_web::{Error, HttpRequest, Result, HttpResponse, web};
use actix::prelude::*;

use crate::{AppState, MostRecent, MostRecentItemsFilter};

#[derive(serde::Serialize, Clone)]
pub struct BroadcastPayload {
    pub items: Vec<MostRecent>,
    pub filters: MostRecentItemsFilter,
}

struct WsActor {
    state: web::Data<AppState>,
}

impl Actor for WsActor {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to broadcast channel and forward updates via actor messages
        let mut rx = self.state.broadcaster.subscribe();
        let addr = ctx.address();

        tokio::spawn(async move {
            while let Ok(payload) = rx.recv().await {
                let _ = addr.do_send(BroadcastItems(payload));
            }
        });
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsActor {
    fn handle(&mut self, _msg: Result<ws::Message, ws::ProtocolError>, _ctx: &mut Self::Context) {
        // No need to handle any incoming messages
    }
}

struct BroadcastItems(BroadcastPayload);

impl Message for BroadcastItems {
    type Result = ();
}

impl Handler<BroadcastItems> for WsActor {
    type Result = ();

    fn handle(&mut self, msg: BroadcastItems, ctx: &mut Self::Context) {
        if let Ok(json) = serde_json::to_string(&msg.0) {
            ctx.text(json);
        }
    }
}

pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let ws = WsActor {
        state: state.clone(),
    };

    ws::start(ws, &req, stream)
}