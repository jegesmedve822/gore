/*document.addEventListener("DOMContentLoaded", function () {
    const userRole = "<%= user.role %>"; // Backendről érkező user role

    if (userRole !== "sysadmin") {
        document.getElementById("admin-actions").style.display = "none";
    }

    if (userRole === "viewer") {
        document.getElementById("register-hiker").style.display = "none";
        document.getElementById("update-data").style.display = "none";
    }
});*/

document.addEventListener("DOMContentLoaded", function () {
    const userRole = "<%= user.role %>"; // Backendről érkező user role

    const adminActions = document.getElementById("admin-actions");
    const registerHiker = document.getElementById("register-hiker");
    const updateData = document.getElementById("update-data");

    // Ha az elem létezik, csak akkor próbáljuk módosítani!
    if (userRole !== "sysadmin" && adminActions) {
        adminActions.style.display = "none";
    }

    if (userRole === "viewer") {
        if (registerHiker) {
            registerHiker.style.display = "none";
        }
        if (updateData) {
            updateData.style.display = "none";
        }
    }
});
