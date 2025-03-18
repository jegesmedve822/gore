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

        //adatok betöltése a kiválasztott sorból
        document.getElementById("edit-id").value = selectedRow.cells[0].textContent;
        document.getElementById("edit-name").value = selectedRow.cells[1].textContent;
        document.getElementById("edit-barcode").value = selectedRow.cells[2].textContent;



        //innen jön a bug fixálás
        function parseDate(dateString) {
            if (!dateString || dateString === "—") return ""; // Ha üres, ne írjunk semmit a mezőbe
            let parts = dateString.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.\s*(\d{1,2}):(\d{2})/);
            if (!parts) return "";
            let [_, year, month, day, hour, minute] = parts;
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
        }


        /*let departure = parseDate(selectedRow.cells[3].textContent);
        let arrival = parseDate(selectedRow.cells[4].textContent);*/

        let departure = parseDate(selectedRow.cells[4].textContent);
        let arrival = parseDate(selectedRow.cells[5].textContent);



        document.getElementById("edit-departure").value = departure;
        document.getElementById("original-departure").value = departure;

        document.getElementById("edit-arrival").value = arrival;
        document.getElementById("original-arrival").value = arrival;

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
        const barcode = document.getElementById("edit-barcode").value;

        let departure = document.getElementById("edit-departure").value;
        let arrival = document.getElementById("edit-arrival").value;

        if (!departure) {
            departure = document.getElementById("original-departure").value || null;
        }
        if (!arrival) {
            arrival = document.getElementById("original-arrival").value || null;
        }
        try {
            const response = await fetch("/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, name, barcode, departure, arrival })
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
