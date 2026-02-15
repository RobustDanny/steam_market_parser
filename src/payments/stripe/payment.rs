use stripe::{Webhook, CheckoutSessionId};
use serde::Deserialize;
use actix_web::{HttpResponse, HttpRequest, web};
use actix_session::{Session};

use crate::db::DataBase;
use crate::AppState;

use steam_market_parser::{
    SteamUser
};

const STRIPE_FEE: f64 = 1.03;
const TASTYROCK_FEE: f64 = 1.04;

#[derive(Deserialize)]
pub struct CreateCheckoutReq {
    pub offer_id: String,
}

pub async fn stripe_create_checkout(
    req: web::Json<CreateCheckoutReq>,
) -> actix_web::Result<HttpResponse> {
    let stripe_key = std::env::var("STRIPE_SECRET_KEY")
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let public_url = std::env::var("PUBLIC_URL")
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let client = stripe::Client::new(stripe_key);

    let db = DataBase::connect_to_db();
    let offer_id = req.offer_id.clone();
    let amount_cents: f64 = db.db_offer_get_offer_price(offer_id.clone());
    let price_with_fee = amount_cents * STRIPE_FEE * TASTYROCK_FEE + 30.0;

    // 1) Create Customer (with name)

    let stripe_customer_id = get_or_create_stripe_customer(&client, &db, &offer_id).await?;

    // 2) Create Checkout Session with that customer
    let mut params = stripe::CreateCheckoutSession::new();
    params.mode = Some(stripe::CheckoutSessionMode::Payment);

    let success_url = format!("{public_url}/api/payment/stripe/success?session_id={{CHECKOUT_SESSION_ID}}");
    let cancel_url  = format!("{public_url}/api/payment/stripe/cancel?session_id={{CHECKOUT_SESSION_ID}}");

    params.success_url = Some(success_url.as_str());
    params.cancel_url  = Some(cancel_url.as_str());

    params.customer = Some(stripe_customer_id);

    params.line_items = Some(vec![
        stripe::CreateCheckoutSessionLineItems {
            quantity: Some(1),
            price_data: Some(stripe::CreateCheckoutSessionLineItemsPriceData {
                currency: stripe::Currency::USD,
                unit_amount: Some(price_with_fee as i64),
                product_data: Some(stripe::CreateCheckoutSessionLineItemsPriceDataProductData {
                    name: format!("TastyRock offer {}", offer_id),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            ..Default::default()
        }
    ]);

    let buyer_steamid = db.db_get_customer_id(&offer_id.to_string());
    let trader_steamid = db.db_get_trader_steamid_by_offer(&offer_id).unwrap_or("unknown".to_string());

    let mut md = std::collections::HashMap::new();
    md.insert("Offer".to_string(), offer_id.clone());
    md.insert("BuyerSteamID".to_string(), buyer_steamid);
    md.insert("TraderSteamID".to_string(), trader_steamid);
    params.metadata = Some(md);


    let mut pi_md = std::collections::HashMap::new();
    pi_md.insert("Offer".to_string(), offer_id.clone());

    params.payment_intent_data = Some(
        stripe::CreateCheckoutSessionPaymentIntentData {
            metadata: Some(pi_md),
            ..Default::default()
        }
    );

    let session = stripe::CheckoutSession::create(&client, params)
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "checkout_url": session.url,
        "session_id": session.id
    })))
}

async fn get_or_create_stripe_customer(
    client: &stripe::Client,
    db: &DataBase,
    offer_id: &str,
) -> actix_web::Result<stripe::CustomerId> {
    // Get steam_id from offer
    let steam_id = db.db_get_customer_id(&offer_id.to_string()); // you return steamid here

    // 1) If we already stored Stripe customer id, reuse it
    if let Some(existing) = db
        .db_get_stripe_customer_id(&steam_id)
        .map_err(actix_web::error::ErrorInternalServerError)?
    {
        let customer_id = existing
            .parse()
            .map_err(actix_web::error::ErrorInternalServerError)?;
        return Ok(customer_id);
    }

    // 2) Otherwise create a new Stripe customer
    let db_customer_params = db
        .db_get_user_params(steam_id.clone())
        .map_err(actix_web::error::ErrorInternalServerError)?;

    let mut customer_params = stripe::CreateCustomer::new();

    // better: put steam_id into metadata, not name
    customer_params.name = Some(db_customer_params.user_steam_id.as_str());

    let mut md = std::collections::HashMap::new();
    md.insert("Nickname".to_string(), db_customer_params.user_name.clone());
    md.insert("Trade url".to_string(), db_customer_params.user_trade_url.clone());
    customer_params.metadata = Some(md);

    let customer = stripe::Customer::create(client, customer_params)
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    // 3) Save it to DB so next time you don’t create duplicates
    db.db_insert_stripe_customer_id(&steam_id, customer.id.as_str())
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(customer.id)
}

pub async fn stripe_webhook(req: HttpRequest, body: web::Bytes) -> HttpResponse {
    let webhook_secret = match std::env::var("STRIPE_WEBHOOK_SECRET") {
        Ok(v) => v,
        Err(_) => return HttpResponse::InternalServerError().finish(),
    };

    let sig = match req.headers().get("Stripe-Signature").and_then(|v| v.to_str().ok()) {
        Some(s) => s,
        None => return HttpResponse::BadRequest().finish(),
    };

    let payload = match std::str::from_utf8(&body) {
        Ok(s) => s,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };

    let event = match Webhook::construct_event(payload, sig, &webhook_secret) {
        Ok(e) => e,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };

    match event.type_ {
        stripe::EventType::CheckoutSessionCompleted => {
            match event.data.object {
                stripe::EventObject::CheckoutSession(session) => {
                    let offer_id = match session.metadata.as_ref().and_then(|m| m.get("Offer")).cloned() {
                        Some(v) => v,
                        None => return HttpResponse::Ok().finish(),
                    };

                    let buyer_steamid = session.metadata.as_ref()
                        .and_then(|m| m.get("BuyerSteamID"))
                        .cloned()
                        .unwrap_or_else(|| "unknown".to_string());

                    let trader_steamid = session.metadata.as_ref()
                        .and_then(|m| m.get("TraderSteamID"))
                        .cloned()
                        .unwrap_or_else(|| "unknown".to_string());

                    let amount_cents: i64 = session.amount_total.unwrap_or(0);

                    let db = DataBase::connect_to_db();

                    // insert buyer transaction
                    if let Err(e) = db.db_insert_transaction(
                        buyer_steamid.clone(),
                        amount_cents.to_string(),
                        "STRIPE".to_string(),
                        "checkout".to_string(),
                    ) {
                        eprintln!("db_insert_transaction failed: {e}");
                        return HttpResponse::InternalServerError().finish();
                    }

                    // get seller connected acct_...
                    let seller_acct = match db.db_get_connected_acct_for_steamid(&trader_steamid) {
                        Ok(Some(acct)) => acct,
                        Ok(None) => {
                            eprintln!("Seller has no connected Stripe account steamid={trader_steamid}");
                            // still ACK ok so Stripe doesn’t retry forever
                            return HttpResponse::Ok().finish();
                        }
                        Err(e) => {
                            eprintln!("db_get_connected_acct_for_steamid failed: {e}");
                            return HttpResponse::InternalServerError().finish();
                        }
                    };

                    // insert seller locked credit (idempotent via UNIQUE stripe_event_id)
                    if let Err(e) = db.db_insert_stripe_wallet_locked(
                        &seller_acct,
                        &offer_id,
                        amount_cents,
                        event.id.as_str(),
                    ) {
                        // if duplicate event, ignore
                        if e.sqlite_error_code() == Some(rusqlite::ErrorCode::ConstraintViolation) {
                            return HttpResponse::Ok().finish();
                        }
                        eprintln!("db_insert_stripe_wallet_locked failed: {e}");
                        return HttpResponse::InternalServerError().finish();
                    }

                    println!("PAID offer_id={offer_id} buyer={buyer_steamid} seller={trader_steamid} amount_cents={amount_cents}");
                    HttpResponse::Ok().finish()
                }
                _ => HttpResponse::BadRequest().finish(),
            }
        }
        _ => HttpResponse::Ok().finish(),
    }
}

#[derive(Deserialize)]
pub struct StripeReturn {
    pub session_id: String,
}

pub async fn payment_success_page(
    q: web::Query<StripeReturn>,
    state: web::Data<AppState>,
) -> actix_web::Result<HttpResponse> {

    let stripe_key = std::env::var("STRIPE_SECRET_KEY")
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let client = stripe::Client::new(stripe_key);

    let sid: CheckoutSessionId = q
        .session_id
        .parse()
        .map_err(actix_web::error::ErrorBadRequest)?;

    let session = stripe::CheckoutSession::retrieve(&client, &sid, &[])
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    let offer_id = session
        .metadata
        .as_ref()
        .and_then(|m| m.get("Offer"))
        .cloned()
        .unwrap_or_else(|| "unknown".to_string());

    let mut ctx = tera::Context::new();
    ctx.insert("offer_id", &offer_id);

    let body = state
        .tera
        .render("transaction/success.html", &ctx)
        .map_err(|_| actix_web::error::ErrorInternalServerError("Template error"))?;

    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}


pub async fn payment_cancel_page(
    q: web::Query<StripeReturn>,
    state: web::Data<AppState>,
) -> actix_web::Result<HttpResponse> {

    let stripe_key = std::env::var("STRIPE_SECRET_KEY")
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let client = stripe::Client::new(stripe_key);

    let sid: CheckoutSessionId = q
        .session_id
        .parse()
        .map_err(actix_web::error::ErrorBadRequest)?;

    let session = stripe::CheckoutSession::retrieve(&client, &sid, &[])
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    let offer_id = session
        .metadata
        .as_ref()
        .and_then(|m| m.get("Offer"))
        .cloned()
        .unwrap_or_else(|| "unknown".to_string());

    let mut ctx = tera::Context::new();
    ctx.insert("offer_id", &offer_id);

    let body = state
        .tera
        .render("transaction/cancel.html", &ctx)
        .map_err(|_| actix_web::error::ErrorInternalServerError("Template error"))?;

    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

pub(crate) async fn create_transfer(
    client: &stripe::Client,
    destination_acct: &str, // acct_...
    amount_cents: i64,
    offer_id: &str,
) -> Result<stripe::Transfer, stripe::StripeError> {
    let mut params = stripe::CreateTransfer::new(
        stripe::Currency::USD,
        destination_acct.to_string(),
    );
    params.amount = Some(amount_cents);

    let mut md = std::collections::HashMap::new();
    md.insert("Offer".to_string(), offer_id.to_string());
    params.metadata = Some(md);

    stripe::Transfer::create(client, params).await
}

pub async fn stripe_connect_start() -> actix_web::Result<HttpResponse> {
    let client_id = std::env::var("STRIPE_CONNECT_CLIENT_ID")
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let public_url = std::env::var("PUBLIC_URL")
        .map_err(actix_web::error::ErrorInternalServerError)?;

    // Your callback URL
    let redirect_uri = format!("{public_url}/api/payment/stripe/connect/callback");

    let url = format!(
        "https://connect.stripe.com/oauth/authorize?response_type=code&client_id={}&scope=read_write&redirect_uri={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
    );

    Ok(HttpResponse::Found()
        .append_header(("Location", url))
        .finish())
}

#[derive(Deserialize)]
pub struct ConnectCallbackQuery {
    pub code: String,
    pub state: Option<String>, // use for CSRF + steamid binding
}

pub async fn stripe_connect_callback(q: web::Query<ConnectCallbackQuery>, session: Session,) -> actix_web::Result<HttpResponse> {
    let secret = std::env::var("STRIPE_SECRET_KEY")
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let client_id = std::env::var("STRIPE_CONNECT_CLIENT_ID")
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let public_url = std::env::var("PUBLIC_URL")
        .map_err(actix_web::error::ErrorInternalServerError)?;

    // must match what you used in /connect/start
    let redirect_uri = format!("{public_url}/api/payment/stripe/connect/callback");

    let http = reqwest::Client::new();
    let resp = http
        .post("https://connect.stripe.com/oauth/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", q.code.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", secret.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    eprintln!("Stripe OAuth token status={status} body={text}");

    // Parse JSON (even if error)
    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(actix_web::error::ErrorBadGateway)?;

    // If Stripe returned an error, show it
    if !status.is_success() || json.get("error").is_some() {
        let err = json.get("error").and_then(|v| v.as_str()).unwrap_or("unknown_error");
        let desc = json.get("error_description").and_then(|v| v.as_str()).unwrap_or("no_description");
        return Ok(HttpResponse::BadRequest().body(format!("Stripe OAuth error: {err}\n{desc}")));
    }

    let acct = json.get("stripe_user_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if !acct.starts_with("acct_") {
        return Ok(HttpResponse::BadRequest().body(format!("Missing stripe_user_id in response: {json}")));
    }

    // TODO: replace with real steamid from session + verify q.state
    let steam_user: SteamUser = session
    .get::<SteamUser>("steam_user")?
    .ok_or_else(|| actix_web::error::ErrorUnauthorized("Not logged in"))?;

    let steamid = steam_user.steamid;

    let db = DataBase::connect_to_db();
    db.db_upsert_user_stripe_id(&steamid, &acct)
        .map_err(actix_web::error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().body(format!("Stripe connected: {acct}")))
}