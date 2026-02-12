use stripe::{Webhook, CheckoutSessionId};
use serde::Deserialize;
use actix_web::{HttpResponse, HttpRequest, web};

use crate::db::DataBase;
use crate::AppState;

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
    let amount_cents: i64 = db.db_offer_get_offer_price(offer_id.clone());

    // 1) Create Customer (with name)
    let mut customer_params = stripe::CreateCustomer::new();
    customer_params.name = Some("Ugine"); // ideally from req

    let mut cust_md = std::collections::HashMap::new();
    cust_md.insert("offer_id".to_string(), offer_id.clone());
    customer_params.metadata = Some(cust_md);

    let customer = stripe::Customer::create(&client, customer_params)
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    // 2) Create Checkout Session with that customer
    let mut params = stripe::CreateCheckoutSession::new();
    params.mode = Some(stripe::CheckoutSessionMode::Payment);

    let success_url = format!("{public_url}/api/payment/stripe/success?session_id={{CHECKOUT_SESSION_ID}}");
    let cancel_url  = format!("{public_url}/api/payment/stripe/cancel?session_id={{CHECKOUT_SESSION_ID}}");

    params.success_url = Some(success_url.as_str());
    params.cancel_url  = Some(cancel_url.as_str());


    params.customer = Some(customer.id);

    params.line_items = Some(vec![
        stripe::CreateCheckoutSessionLineItems {
            quantity: Some(1),
            price_data: Some(stripe::CreateCheckoutSessionLineItemsPriceData {
                currency: stripe::Currency::USD,
                unit_amount: Some(amount_cents),
                product_data: Some(stripe::CreateCheckoutSessionLineItemsPriceDataProductData {
                    name: format!("TastyRock offer {}", offer_id),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            ..Default::default()
        }
    ]);

    let mut md = std::collections::HashMap::new();
    md.insert("offer_id".to_string(), offer_id.clone());
    params.metadata = Some(md);

    let session = stripe::CheckoutSession::create(&client, params)
        .await
        .map_err(actix_web::error::ErrorBadGateway)?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "checkout_url": session.url,
        "session_id": session.id
    })))
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
                    if let Some(offer_id) = session
                        .metadata
                        .as_ref()
                        .and_then(|m| m.get("offer_id"))
                        .cloned()
                    {
                        // TODO: idempotency by event.id (store in DB as unique)
                        // TODO: update offer status -> PAID
                        // session.payment_intent, session.customer, session.customer_details...
                        println!("PAID offer_id={offer_id}");
                    }
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
        .and_then(|m| m.get("offer_id"))
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
        .and_then(|m| m.get("offer_id"))
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
