document.addEventListener("DOMContentLoaded", function () {
    const userRole = "<%= user.role %>"; // Backendről érkező user role

    if (userRole !== "sysadmin") {
        document.getElementById("admin-actions").style.display = "none";
    }

    if (userRole === "viewer") {
        document.getElementById("register-hiker").style.display = "none";
        document.getElementById("update-data").style.display = "none";
    }
});