var slideMenu = document.getElementsByTagName("nav")[0];
var slideButton = slideMenu.nextElementSibling;

function toggleMenu() {
    if (slideMenu.style.marginLeft == "-250px") {
        slideMenu.style.marginLeft = "0px";
        slideButton.style.left = "250px";
        slideButton.firstElementChild.style.transform = "translateX(3px) rotate(135deg)";
    }
    else {
        slideMenu.style.marginLeft = "-250px";
        slideButton.style.left = "0px";
        slideButton.firstElementChild.style.transform = "translateX(4px) rotate(-45deg)";
    }
}
