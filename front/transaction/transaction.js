document.getElementById("transaction_close_btn")?.addEventListener("click", () => {
    window.close();

    setTimeout(() => {
        window.location.href = "/";
    }, 300);
});