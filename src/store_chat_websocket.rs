use actix_web_actors::ws;
use actix::Addr;
use actix_web::{Error, HttpRequest, Result, HttpResponse, web};
use actix::prelude::*;

use steam_market_parser::{
    ChatQuery,
};

#[derive(serde::Serialize, Clone)]
pub struct RoomId {
    buyer_steamid: String,
    trader_steamid: String,
}

pub struct WsSession {
    buyer_steamid: String,
    trader_steamid: String,
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
    addr: Addr<WsSession>,
}

struct ChatHub{
    rooms: HashMap<RoomId, HashSet<Addr<WsSession>>>
}

impl ChatHub {
    fn new()->Self{
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
    }
}

impl Handler<Leave> for ChatHub{
    type Result = ();

    fn handle(&mut self, msg: Leave, _: &mut Context<Self>){
        self.rooms
        .entry(msg.room)
        .or_default()
        .insert(msg.addr);
    }
}

impl Actor for ChatHub{
    type Context = Context<Self>;
}

impl Actor for RoomId {
    type Context = ws::WebsocketContext<Self>;
    
    fn started(&mut self, _: &mut Self::Context) {
        println!("Chat session started between {} and {}", self.buyer_steamid, self.trader_steamid);
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        println!("Chat session ended between {} and {}", self.buyer_steamid, self.trader_steamid);
    }

}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for RoomId
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

    let session = RoomId {
        buyer_steamid: buyer_steamid.clone(),
        trader_steamid: trader_steamid.clone(),
    };

    ws::start(session, &req, stream)
}