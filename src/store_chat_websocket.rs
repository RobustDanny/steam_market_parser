use actix_web_actors::ws;
use actix::Addr;
use actix_web::{Error, HttpRequest, Result, HttpResponse, web};
use actix::prelude::*;
use std::collections::{HashMap, HashSet};

use steam_market_parser::{
    ChatQuery,
};

#[derive(Hash, Eq, PartialEq, Clone, Debug)]
pub struct RoomId {
    buyer_steamid: String,
    trader_steamid: String,
}

pub struct WsSession {
    room: RoomId,
    hub: Addr<ChatHub>,
    offer_id: Option<String>,
    role: String, // "buyer" | "trader"
}


#[derive(Message)]
#[rtype(result = "()")]
struct WsText(pub String);

impl Handler<WsText> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: WsText, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hub.do_send(Join {
            room: self.room.clone(),
            addr: ctx.address(),
            role: self.role.clone(), // <-- add
        });
    }
    

    fn stopped(&mut self, ctx: &mut Self::Context) {
        self.hub.do_send(Leave {
            room: self.room.clone(),
            addr: ctx.address(),
        });
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, _: &mut Self::Context) {
        let Ok(ws::Message::Text(text)) = msg else { return };

        let parsed: serde_json::Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => return,
        };

        let msg_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match msg_type {
            "chat" | "system" => {
                let body = parsed
                    .get("text")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();

                if body.is_empty() {
                    return;
                }

                self.hub.do_send(Broadcast {
                    room: self.room.clone(),
                    msg_type: msg_type.to_string(),
                    from_role: self.role.clone(),
                    text: body,
                });
            }

            "offer_items" => {
                self.hub.do_send(Broadcast {
                    room: self.room.clone(),
                    msg_type: "offer_items".to_string(),
                    from_role: self.role.clone(),
                    text: parsed.to_string(), // full JSON
                });
            }

            "set_offer" => {
                let offer_id = parsed
                    .get("offer_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());

                self.offer_id = offer_id.clone();

                self.hub.do_send(Broadcast {
                    room: self.room.clone(),
                    msg_type: "system".to_string(),
                    from_role: self.role.clone(),
                    text: self.offer_id.clone().unwrap() + " is created",
                });

                self.hub.do_send(OfferState {
                    room: self.room.clone(),
                    offer_id,
                    msg_type: "set_offer".to_string(),
                    offer_accepted: false,
                    offer_dirty: true,
                    offer_paid: false,
                    offer_send: true,
                    // text: "set_offer".to_string(),
                });

                
            }

            "send_offer" => {
                
                self.hub.do_send(OfferState {
                    room: self.room.clone(),
                    offer_id: self.offer_id.clone(),
                    msg_type: "send_offer".to_string(),
                    offer_accepted: false,
                    offer_dirty: false,
                    offer_paid: false,
                    offer_send: true,
                    // text: "send_offer".to_string(),
                });
            }

            "accept_offer" => {

                self.hub.do_send(OfferState {
                    room: self.room.clone(),
                    offer_id: self.offer_id.clone(),
                    msg_type: "accept_offer".to_string(),
                    offer_accepted: true,
                    offer_dirty: false,
                    offer_paid: false,
                    offer_send: true,
                    // text: parsed.to_string(),
                });
            }

            "paid_offer" => {

                self.hub.do_send(OfferState {
                    room: self.room.clone(),
                    offer_id: self.offer_id.clone(),
                    msg_type: "paid_offer".to_string(),
                    offer_accepted: true,
                    offer_dirty: false,
                    offer_paid: true,
                    offer_send: true,
                    // text: parsed.to_string(),
                });
            }

            "clear_offer" => {
                self.offer_id = None;

                self.hub.do_send(OfferState {
                    room: self.room.clone(),
                    offer_id: None,
                    msg_type: "clear_offer".to_string(),
                    offer_accepted: false,
                    offer_dirty: false,
                    offer_paid: false,
                    offer_send: false,
                    // text: parsed.to_string(),
                });
            }

            _ => {}
        }
        
    }
}

#[derive(Message)]
#[rtype(result = "()")]
struct Join {
    room: RoomId,
    addr: Addr<WsSession>,
    role: String, // <-- add
}


#[derive(Message)]
#[rtype(result = "()")]
struct Leave {
    room: RoomId,
    addr: Addr<WsSession>,
}

#[derive(Message)]
#[rtype(result = "()")]
struct Broadcast {
    room: RoomId,
    msg_type: String,   // "chat" | "system"
    from_role: String,  // "buyer" | "trader" | "system"
    text: String,
}

pub struct RoomState {
    pub clients: HashMap<Addr<WsSession>, String>, // addr -> role
    pub offer_id: Option<String>,
}

pub struct ChatHub {
    pub rooms: HashMap<RoomId, RoomState>,
}

impl ChatHub {
    pub fn new()->Self{
        Self{
            rooms: HashMap::new(),
        }
    }

    fn broadcast_presence(&self, room_id: &RoomId) {
        let Some(state) = self.rooms.get(room_id) else { return };
    
        let mut buyer_present = false;
        let mut trader_present = false;
    
        for role in state.clients.values() {
            if role == "buyer" { buyer_present = true; }
            if role == "trader" { trader_present = true; }
        }
    
        let payload = serde_json::json!({
            "type": "presence",
            "count": state.clients.len(),
            "buyer_present": buyer_present,
            "trader_present": trader_present,
            "offer_id": state.offer_id, // optional: expose to clients
        }).to_string();
    
        for addr in state.clients.keys() {
            addr.do_send(WsText(payload.clone()));
        }
    }
    
}

impl Handler<Join> for ChatHub {
    type Result = ();

    fn handle(&mut self, msg: Join, _: &mut Context<Self>) {
        let state = self.rooms.entry(msg.room.clone()).or_insert(RoomState {
            clients: HashMap::new(),
            offer_id: None,
        });

        state.clients.insert(msg.addr.clone(), msg.role);


        // ✅ send offer_id to ONLY the newly joined client as a system message
        if let Some(ref offer_id) = state.offer_id {
            let payload = serde_json::json!({
                "type": "system",
                "from_role": "system",
                "offer_id": offer_id,
                "text": format!("{offer_id} is created")
            })
            .to_string();

            msg.addr.do_send(WsText(payload));
        }

        self.broadcast_presence(&msg.room);
    }
}


impl Handler<Leave> for ChatHub {
    type Result = ();

    fn handle(&mut self, msg: Leave, _: &mut Context<Self>) {
        if let Some(state) = self.rooms.get_mut(&msg.room) {
            state.clients.remove(&msg.addr);

            if state.clients.is_empty() {
                self.rooms.remove(&msg.room);
                return;
            }
        }

        self.broadcast_presence(&msg.room);
    }
}

impl Handler<Broadcast> for ChatHub {
    type Result = ();

    fn handle(&mut self, msg: Broadcast, _: &mut Context<Self>) {
        let Some(state) = self.rooms.get(&msg.room) else { return };

        let payload = if msg.msg_type == "offer_items" {
            let v: serde_json::Value = serde_json::from_str(&msg.text).unwrap();
            serde_json::json!({
                "type": "offer_items",
                "from_role": msg.from_role,
                "offer_id": state.offer_id, // <-- now available here
                "items": v.get("items").unwrap()
            })
        } else {
            serde_json::json!({
                "type": msg.msg_type,
                "from_role": msg.from_role,
                "offer_id": state.offer_id, // <-- now available here
                "text": msg.text
            })
        };

        let payload = payload.to_string();

        for addr in state.clients.keys() {
            addr.do_send(WsText(payload.clone()));
        }
    }
}

#[derive(Message)]
#[rtype(result = "()")]
struct OfferState {
    room: RoomId,
    msg_type: String,
    offer_id: Option<String>,
    offer_accepted: bool,
    offer_dirty: bool,
    offer_paid: bool,
    offer_send: bool,
    // text: String,
}

impl Handler<OfferState> for ChatHub {
    type Result = ();

    fn handle(&mut self, msg: OfferState, _: &mut Context<Self>) {
        let Some(state) = self.rooms.get_mut(&msg.room) else { return };

        state.offer_id = msg.offer_id.clone();

        let payload = serde_json::json!({
            "type": msg.msg_type,
            "offer_id": msg.offer_id,
            "offer_dirty": msg.offer_dirty,
            "offer_send": msg.offer_send,
            "offer_accepted": msg.offer_accepted,
            "offer_paid": msg.offer_paid,
            // "text": msg.text,
        })
        .to_string();

        for addr in state.clients.keys() {
            addr.do_send(WsText(payload.clone()));
        }
    }
}


impl Actor for ChatHub{
    type Context = Context<Self>;
}

pub async fn ws_chat_handler(
    req: HttpRequest,
    stream: web::Payload,
    query: web::Query<ChatQuery>,
    hub: web::Data<Addr<ChatHub>>,
) -> Result<HttpResponse, Error> {

    let room = RoomId {
        buyer_steamid: query.buyer.clone(),
        trader_steamid: query.trader.clone(),
    };

    let role = match query.role.as_deref() {
        Some("buyer") => "buyer",
        Some("trader") => "trader",
        _ => "buyer", // safe default
    }.to_string();

    let session = WsSession {
        room,
        hub: hub.get_ref().clone(),
        offer_id: None,
        role,
    };

    ws::start(session, &req, stream)
}