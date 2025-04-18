document.addEventListener("DOMContentLoaded", function () {
    const registerForm = document.getElementById("registerForm");
    const messageElement = document.getElementById("message");

    const barcodeInput = document.getElementById("barcode");
    const nameInput = document.getElementById("name");
    const distanceSelect = document.getElementById("distance");
    const phoneNumber = document.getElementById("phone");

    let timeoutId;
    barcodeInput.focus();

    // Regisztráció AJAX
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault(); // Ne töltse újra az oldalt!

        const formData = new URLSearchParams(new FormData(registerForm));
        const selectedDistance = distanceSelect.value;

        const response = await fetch("/registerhiker", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });

        const data = await response.json();

        // Üzenet kiírása a frontendre
        messageElement.textContent = data.message;
        messageElement.className = data.status; // success vagy error class

        if(timeoutId) {
            clearTimeout(timeoutId);
        }

        // 3 másodperc múlva eltünteti az üzenetet
        timeoutId = setTimeout(() => {
            messageElement.textContent = "";
            messageElement.className = "";
        }, 3000);

        if(data.status === "success") {
            barcodeInput.value = "";
            nameInput.value = "";
            distanceSelect.value = selectedDistance;
            phoneNumber.value = "";
            barcodeInput.focus();
        }

    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            const activeElement = document.activeElement;

            if (activeElement === barcodeInput) {
                event.preventDefault();

                const barcodeValue = barcodeInput.value.trim();
                const distanceCode = barcodeValue.substring(2, 4); // 2-3. karakterek


                if (["12", "24", "34"].includes(distanceCode)) {
                    distanceSelect.value = distanceCode;
                    nameInput.focus();
                } else {
                    distanceSelect.focus();
                }
            } else {
                // Ha nem a vonalkód mezőn vagyunk, akkor submit
                event.preventDefault();
                registerForm.requestSubmit();
            }
        }
    });

});
