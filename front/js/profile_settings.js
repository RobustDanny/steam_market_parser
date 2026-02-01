document.getElementById("open_setting_form")?.addEventListener("click", () => {
    document.getElementById("settings_form").style.display = "flex";
  });

document.getElementById("settings_form").addEventListener("click", (e) => {
    if (e.target === document.getElementById("settings_form")) {
        document.getElementById("settings_form").style.display = "none"; 
    }
});