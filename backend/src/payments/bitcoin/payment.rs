use actix_web::{web, HttpRequest, HttpResponse, Responder};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateInvoiceReq {
    pub offer_id: String,
    pub amount_usd: f64, // IMPORTANT: in production compute this from DB, don't trust client
}

#[derive(Serialize)]
pub struct CreateInvoiceResp {
    pub invoice_id: String,
    pub status: String,
    pub checkout_link: String,
}

pub async fn btc_create_invoice(req: web::Json<CreateInvoiceReq>) -> impl Responder {
    let btcpay_url = std::env::var("BTCPAY_URL").unwrap();
    let store_id = std::env::var("BTCPAY_STORE_ID").unwrap();
    let api_key = std::env::var("BTCPAY_API_KEY").unwrap();

    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "amount": req.amount_usd,
        "currency": "USD",
        "metadata": {
            "orderId": req.offer_id
        }
    });

    let url = format!("{}/api/v1/stores/{}/invoices", btcpay_url, store_id);

    let r = match client.post(url).bearer_auth(api_key).json(&body).send().await {
        Ok(x) => x,
        Err(e) => return HttpResponse::BadRequest().body(format!("BTCPay request error: {e}")),
    };

    if !r.status().is_success() {
        let t = r.text().await.unwrap_or_default();
        return HttpResponse::BadRequest().body(t);
    }

    let v: serde_json::Value = r.json().await.unwrap();

    let invoice_id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string();
    let status = v.get("status").and_then(|x| x.as_str()).unwrap_or("").to_string();
    let checkout_link = v.get("checkoutLink").and_then(|x| x.as_str()).unwrap_or("").to_string();

    // TODO: save mapping (offer_id -> invoice_id) in DB
    // TODO: broadcast to chat room "invoice created"

    HttpResponse::Ok().json(CreateInvoiceResp { invoice_id, status, checkout_link })
}

#[derive(Serialize)]
pub struct StatusResp {
    pub status: String,
}

pub async fn btc_invoice_status(q: web::Query<std::collections::HashMap<String, String>>) -> impl Responder {
    let invoice_id = match q.get("invoice_id") {
        Some(x) => x.clone(),
        None => return HttpResponse::BadRequest().body("invoice_id required"),
    };

    let btcpay_url = std::env::var("BTCPAY_URL").unwrap();
    let api_key = std::env::var("BTCPAY_API_KEY").unwrap();
    let client = reqwest::Client::new();

    let url = format!("{}/api/v1/invoices/{}", btcpay_url, invoice_id);

    let r = match client.get(url).bearer_auth(api_key).send().await {
        Ok(x) => x,
        Err(e) => return HttpResponse::BadRequest().body(format!("BTCPay request error: {e}")),
    };

    if !r.status().is_success() {
        let t = r.text().await.unwrap_or_default();
        return HttpResponse::BadRequest().body(t);
    }

    let v: serde_json::Value = r.json().await.unwrap();
    let status = v.get("status").and_then(|x| x.as_str()).unwrap_or("").to_string();

    HttpResponse::Ok().json(StatusResp { status })
}

#[derive(Deserialize)]
pub struct WebhookEvent {
    #[serde(rename = "invoiceId")]
    pub invoice_id: String,
    #[serde(rename = "type")]
    pub event_type: String,
}

pub async fn btcpay_webhook(_http_req: HttpRequest, payload: web::Json<WebhookEvent>) -> impl Responder {
    // RECOMMENDED:
    // verify webhook signature using BTCPAY_WEBHOOK_SECRET and headers
    // (exact header names depend on BTCPay webhook settings)

    // Example: update your offer status when settled/complete-ish event arrives:
    let event = &payload.event_type;

    // Common events include ones like "InvoiceCreated", "InvoiceReceivedPayment", "InvoiceSettled"
    // Exact strings can vary by BTCPay version/config, so log first.
    println!("BTCPay webhook: invoice={} type={}", payload.invoice_id, payload.event_type);

    // TODO:
    // 1) lookup offer_id by invoice_id in DB
    // 2) if event indicates paid/settled => mark offer as PAID
    // 3) notify both buyer+trader via your ChatHub websocket

    HttpResponse::Ok().finish()
}
