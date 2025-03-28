document.addEventListener("DOMContentLoaded", function () {
    const starterForm = document.getElementById("starterForm");
    const sMessageElement = document.getElementById("s-message");
    const name = document.getElementById("hiker-name");
    const completion = document.getElementById("completion-result");
    const barcodeInput = document.getElementById("barcode");

    let timeoutId;


    //AJAX hozzáadása
    starterForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const sformData = new URLSearchParams(new FormData(starterForm));

        const response = await fetch("/checkpointinsert", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: sformData
        });
        
        const data = await response.json();

        // Üzenet kiírása a frontendre
        sMessageElement.textContent = data.message;
        sMessageElement.className = data.status; // success vagy error class
        name.textContent = data.hikerName;
        completion.textContent = data.completion;
        completion.className = data.isInTime;

        barcodeInput.value="";
        barcodeInput.focus();

        if(timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            sMessageElement.textContent = "";
            sMessageElement.className = "";
            name.textContent = "";
            completion.textContent = "";
            completion.className = "";

            timeoutId = null;
        }, 4000);

    });
});