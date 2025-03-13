document.addEventListener("DOMContentLoaded", function () {
    const registerForm = document.getElementById("registerForm");
    const messageElement = document.getElementById("message");

    // Regisztráció AJAX
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault(); // Ne töltse újra az oldalt!

        const formData = new URLSearchParams(new FormData(registerForm));

        const response = await fetch("/registerhiker", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });

        const data = await response.json();

        // Üzenet kiírása a frontendre
        messageElement.textContent = data.message;
        messageElement.className = data.status; // success vagy error class

        // 3 másodperc múlva eltünteti az üzenetet
        setTimeout(() => {
            messageElement.textContent = "";
            messageElement.className = "";
        }, 3000);
    });
});
