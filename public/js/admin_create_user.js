document.addEventListener("DOMContentLoaded", function () {
    const actionSelect = document.getElementById("action");
    const adminForm = document.getElementById("adminForm");
    const messageElement = document.getElementById("message");

    const createFields = document.getElementById("createFields");
    const deleteFields = document.getElementById("deleteFields");
    const updateFields = document.getElementById("updateFields");

    actionSelect.addEventListener("change", function () {
        adminForm.style.display = "none";
        createFields.style.display = "none";
        deleteFields.style.display = "none";
        updateFields.style.display = "none";

        if (this.value) {
            adminForm.style.display = "block";
            if (this.value === "create") createFields.style.display = "block";
            if (this.value === "delete") deleteFields.style.display = "block";
            if (this.value === "update") updateFields.style.display = "block";
        }
    });

    adminForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const action = actionSelect.value;
        let bodyData = {};

        if (action === "create") {
            bodyData = {
                action,
                username: document.getElementById("username").value,
                email: document.getElementById("email").value,
                password: document.getElementById("password").value,
                role: document.getElementById("role").value
            };
        } else if (action === "delete") {
            bodyData = {
                action,
                username: document.getElementById("deleteUsername").value
            };
        } else if (action === "update") {
            bodyData = {
                action,
                username: document.getElementById("updateUsername").value,
                role: document.getElementById("updateRole").value
            };
        }

        const response = await fetch("/create-sysuser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();
        messageElement.textContent = data.message;
        messageElement.className = data.status;

        setTimeout(() => {
            messageElement.textContent = "";
            messageElement.className = "";
        }, 3000);
    });
});
