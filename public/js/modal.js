document.addEventListener("DOMContentLoaded", function () {
    const modifyButton = document.getElementById("modify-data");
    const modal = document.getElementById("editModal");
    const closeButton = document.querySelector(".close");
    const editForm = document.getElementById("editForm");
    const messageElement = document.getElementById("message");

    function showMessage(message, status) {
        messageElement.textContent = message;
        messageElement.className = status;

        setTimeout(() => {
            messageElement.textContent="";
            messageElement.className="";
        }, 4000);
    }

    //dinamikus eseménykezelő
    document.getElementById("hikersTable").addEventListener("click", function (event) {
        let row = event.target.closest("tr");
        if(!row) return;

        document.querySelectorAll("#hikersTable tbody tr").forEach(r => r.classList.remove("selected"));
        row.classList.add("selected");
    });

    //modal megnyitása ha rákattintunk a módosítás gombra
    modifyButton.addEventListener("click", function () {
        let selectedRow = document.querySelector("#hikersTable tbody tr.selected");
        if(!selectedRow) {
            showMessage("Először válaszd ki a módosítani kívánt versenyzőt!", "error");
            return;
        }

        const departureRaw = selectedRow.getAttribute("data-departure");
        const arrivalRaw = selectedRow.getAttribute("data-arrival");

        document.getElementById("original-departure-date").value = departureRaw || "";
        document.getElementById("original-arrival-date").value = arrivalRaw || "";

        document.getElementById("edit-departure").value = parseDateTimeLocal(departureRaw);
        document.getElementById("edit-arrival").value = parseDateTimeLocal(arrivalRaw);




        const id = selectedRow.getAttribute("data-id");
        document.getElementById("edit-id").value = id;
        document.getElementById("edit-name").value = selectedRow.cells[1].textContent;
        document.getElementById("edit-barcode").value = selectedRow.cells[2].textContent;
        document.getElementById("edit-distance").value = selectedRow.cells[3].textContent;
        document.getElementById("edit-phone").value = selectedRow.cells[4].textContent;



        //innen jön a bug fixálás
        function parseDate(dateString) {
            if (!dateString || dateString === "—") return "";
            let parts = dateString.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.\s*(\d{1,2}):(\d{2})/);
            if (!parts) return "";
            let [_, year, month, day, hour, minute] = parts;
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
        }

        function parseTimeOnly(timeString) {
            if (!timeString || timeString === "—") return "";
            const [hour, minute, second] = timeString.split(":");
            return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${(second || "00").padStart(2, "0")}`;
        }

        function parseDateTimeLocal(dateString) {
            if (!dateString || dateString === "—") return "";
            const d = new Date(dateString);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const hour = String(d.getHours()).padStart(2, "0");
            const minute = String(d.getMinutes()).padStart(2, "0");
            const second = String(d.getSeconds()).padStart(2, "0");
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        }        
        
        

        //let departure = parseTimeOnly(selectedRow.cells[5].textContent);
        //let arrival = parseTimeOnly(selectedRow.cells[6].textContent);



        //document.getElementById("edit-departure").value = departure;
        //document.getElementById("original-departure-date").value = departure;

        //document.getElementById("edit-arrival").value = arrival;
        //document.getElementById("original-arrival-date").value = arrival;

        modal.style.display = "block";
    });

    //modal bezárása
    closeButton.addEventListener("click", function () {
        modal.style.display = "none"
    });

    //módosítás beküldése AJAX-al
    editForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("edit-id").value;
        const name = document.getElementById("edit-name").value;
        const distance = document.getElementById("edit-distance").value;
        const barcode = document.getElementById("edit-barcode").value;
        const phone = document.getElementById("edit-phone").value;


        //dátum idő összefűzése
        let departureDate = document.getElementById("original-departure-date").value;
        let departureTime = document.getElementById("edit-departure").value;
        let arrivalDate = document.getElementById("original-arrival-date").value;
        let arrivalTime = document.getElementById("edit-arrival").value;


        //a fentit szedtük ki, ezt rakjuk le
        const today = new Date().toISOString().split("T")[0];

        if (!departureDate && departureTime) {
            departureDate = today;
        }
        if (!arrivalDate && arrivalTime) {
            arrivalDate = today;
        }

        //let departure = (departureDate && departureTime) ? `${departureDate}T${departureTime}` : null;
        //let arrival = (arrivalDate && arrivalTime) ? `${arrivalDate}T${arrivalTime}` : null;
        let departure = departureTime || null;
        let arrival = arrivalTime || null;



        try {
            const response = await fetch("/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, name, barcode, distance, phone, departure, arrival })
            });

            if(response.status === 403) {
                showMessage("Nincs jogosultságod az adatmódosításhoz!", "error");
                modal.style.display = "none";
                return;
            }

            const data = await response.json();
            showMessage(data.message, data.status);

            if(data.status === "success") {
                modal.style.display ="none"
                loadHikers();
            }
        } catch(error) {
            showMessage("Ismeretlen hiba történt.", "error");
            console.log(error);
        }
    });

    //ha bárhová kattintunk a modalon kívül, az ablak záródjon be
    window.addEventListener("click", function(event) {
        if(event.target === modal) {
            modal.style.display = "none";
        }
    });

    //sor kiválasztása a táblázatból
    document.querySelectorAll("#hikersTable tbody tr").forEach(row => {
        row.addEventListener("click", function () {
            document.querySelectorAll("#hikersTable tbody tr").forEach(r => r.classList.remove("selected"));
            this.classList.add("selected");
        });
    });
});
