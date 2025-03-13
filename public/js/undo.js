document.addEventListener("DOMContentLoaded", function () {
    const undoForm = document.getElementById("undoForm");
    const undoButton = document.querySelector("#undoForm button");
    const messageElement = document.getElementById("message");

    // Visszavonás AJAX
    undoForm.addEventListener("submit", async function (event) {
        event.preventDefault(); // Megakadályozza az oldal újratöltését

        const response = await fetch("/undo", {
            method: "POST",
        });

        const data = await response.json();

        // Üzenet kiírása
        messageElement.textContent = data.message;
        messageElement.className = data.status;


        // 3 másodperc múlva eltünteti az üzenetet
        setTimeout(() => {
            messageElement.textContent = "";
            messageElement.className = "";
        }, 3000);
    });
});
