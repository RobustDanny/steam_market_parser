use steam_openid::SteamOpenId;
use actix_web::{HttpResponse, Responder};
use actix_session::Session;
use std::env;

use steam_market_parser::SteamUser;
use crate::db::DataBase;

pub async fn steam_login() -> impl Responder {
    let realm = "http://localhost:8080";
    let path = "/api/auth/steam/return";
    let steam_openid = match SteamOpenId::new(realm, path) {
        Ok(openid) => openid,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .body("Failed to initialize Steam OpenID");
        }
    };

    let url = steam_openid.get_redirect_url();
    HttpResponse::Found()
        .append_header(("Location", url))
        .finish()
}

pub async fn steam_return(
    req: actix_web::HttpRequest,
    session: Session,
) -> impl Responder {
    let realm = "http://localhost:8080";
    let path = "/api/auth/steam/return";
    
    let steam_openid = match SteamOpenId::new(realm, path) {
        Ok(openid) => openid,
        Err(_) => {
            return HttpResponse::InternalServerError()
                .body("Failed to initialize Steam OpenID");
        }
    };

    let query_string = req.query_string();
    match steam_openid.verify(query_string).await {
        Ok(steamid) => {
            // Save SteamID in session
            let steamid_str = steamid.to_string();
            
            // Load profile (ignore errors - don't block login if profile loading fails)
            if let Ok(steam_user) = load_steam_profile(&steamid_str).await {
                session.insert("steam_user", steam_user).unwrap();
            }

            HttpResponse::Found()
                .append_header(("Location", "/"))
                .finish()
        }
        Err(e) => {
            HttpResponse::BadRequest().body(format!("Steam login failed: {:?}", e))
        }
    }
}

pub async fn load_steam_profile(steamid: &str) -> Result<SteamUser, Box<dyn std::error::Error>> {
    let api_key = env::var("STEAM_API_KEY")?;
    let url = format!(
        "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key={}&steamids={}",
        api_key, steamid
    );
    
    let response = reqwest::get(url).await?;
    let text = response.text().await?;
    let data: serde_json::Value = serde_json::from_str(&text)?;
    let player = data["response"]["players"][0].clone();

    let steam_user_struct = SteamUser{
        steamid: player["steamid"].as_str()
            .ok_or("Missing steamid field")?.to_string(),
        nickname: player["personaname"].as_str()
            .ok_or("Missing personaname field")?.to_string(),
        avatar_url_small: player["avatar"].as_str()
            .ok_or("Missing avatar field")?.to_string(),
        avatar_url_full: player["avatarfull"].as_str()
            .ok_or("Missing avatarfull field")?.to_string(),
    };
        
    let db = DataBase::connect_to_db();
    db.db_add_steam_user(&steam_user_struct);
    Ok(steam_user_struct)
}

