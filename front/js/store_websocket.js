let storeChatWS = null;

function sendChatMessage() {
    if (!storeChatWS || storeChatWS.readyState !== WebSocket.OPEN) {
        console.warn("WS not connected");
        return;
    }

    const input = document.getElementById("chat_input");
    const text = input.value.trim();

    if (!text) return;

    const message = {
        type: "chat",
        text: text
    };

    storeChatWS.send(JSON.stringify(message));

    // Optimistic UI (show immediately)
    appendChatMessage("me", text);

    input.value = "";
}

function appendChatMessage(from, text) {
    const container = document.getElementById("chat_messages");

    const messageEl = document.createElement("div");
    messageEl.className = from === "me"
        ? "chat_message chat_message_me"
        : "chat_message chat_message_other";

    messageEl.textContent = text;

    container.appendChild(messageEl);

    // Auto scroll
    container.scrollTop = container.scrollHeight;
}

export function connectStoreChatWS(buyerId, traderId) {
    if (storeChatWS?.readyState === WebSocket.OPEN) {
        console.warn("WS already connected");
        return;
    }

    const wsUrl = `ws://127.0.0.1:8080/ws/chat?buyer=${buyerId}&trader=${traderId}`;

    storeChatWS = new WebSocket(wsUrl);

    storeChatWS.onopen = () => {
        console.log("STORE CHAT WS CONNECTED");
    };

    storeChatWS.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        appendChatMessage(msg.from, msg.text);
    };

    storeChatWS.onclose = () => {
        console.log("STORE CHAT WS CLOSED");
        storeChatWS = null;
    };

    storeChatWS.onerror = (e) => {
        console.error("STORE CHAT WS ERROR", e);
    };
}