// const arrow_up = document.getElementById("arrow_up");
//   const pause = document.getElementById("pause");
//   const arrow_down = document.getElementById("arrow_down");

//   sticky_tooltip(arrow_up);
//   sticky_tooltip(pause);
//   sticky_tooltip(arrow_down);

function sticky_tooltip(element){
    const tooltip = element.nextElementSibling;
    
    element.addEventListener("mouseenter", () => {
        tooltip.style.opacity = "1";
        tooltip.style.visibility = "visible";
    });
    
    element.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden";
    });
    
    element.addEventListener("mousemove", (e) => {
        tooltip.style.left = e.clientX + 12 + "px";
        tooltip.style.top = e.clientY + 12 + "px";
    });
}