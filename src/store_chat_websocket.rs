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
        if let Ok(ws::Message::Text(text)) = msg {
            self.hub.do_send(Broadcast {
                room: self.room.clone(),
                text: text.to_string(),
            });
        }
    }
}

#[derive(Message)]
#[rtype(result = "()")]
struct Join {
    room: RoomId,
    addr: Addr<WsSession>,
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
    text: String,
}

pub struct ChatHub{
    pub rooms: HashMap<RoomId, HashSet<Addr<WsSession>>>
}

impl ChatHub {
    pub fn new()->Self{
        Self{
            rooms: HashMap::new(),
        }
    }
}

impl Handler<Join> for ChatHub{
    type Result = ();

    fn handle(&mut self, msg: Join, _: &mut Context<Self>){
        self.rooms
        .entry(msg.room)
        .or_default()
        .insert(msg.addr);

    println!("Rooms: {:?}", self.rooms);
    }
}

impl Handler<Leave> for ChatHub {
    type Result = ();

    fn handle(&mut self, msg: Leave, _: &mut Context<Self>) {
        if let Some(room) = self.rooms.get_mut(&msg.room) {
            room.remove(&msg.addr);
            if room.is_empty() {
                self.rooms.remove(&msg.room);
            }
        }
    }
}

impl Handler<Broadcast> for ChatHub {
    type Result = ();

    fn handle(&mut self, msg: Broadcast, _: &mut Context<Self>) {
        if let Some(room) = self.rooms.get(&msg.room) {
            for addr in room {
                addr.do_send(WsText(msg.text.clone()));
            }
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
    
    let session = WsSession {
        room,
        hub: hub.get_ref().clone(),
    };

    ws::start(session, &req, stream)
}