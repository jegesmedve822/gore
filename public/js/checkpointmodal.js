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


    const stationMap = {
        12: ["piros_haz", "gyugy", "gore_kilato"],
        24: ["kishegy", "piros_haz", "gyugy", "gore_kilato"],
        34: ["kishegy", "piros_haz", "harsas_puszta", "bendek_puszta", "gyugy", "gore_kilato"]
    };

    const stationLabels = {
        piros_haz: "Piros ház",
        gyugy: "Gyugy",
        gore_kilato: "Göre-kilátó",
        kishegy: "Kishegy",
        harsas_puszta: "Hársas-puszta",
        bendek_puszta: "Béndek-puszta"
    };

    //dinamikus eseménykezelő
    document.getElementById("checkpointTable").addEventListener("click", function (event) {
        let row = event.target.closest("tr");
        if(!row) return;

        document.querySelectorAll("#checkpointTable tbody tr").forEach(r => r.classList.remove("selected"));
        row.classList.add("selected");
    });

    //modal megnyitása
    modifyButton.addEventListener("click", function () {
        let selectedRow = document.querySelector("#checkpointTable tbody tr.selected");
        if(!selectedRow) {
            showMessage("Először válaszd ki a módosítani kívánt versenyzőt!", "error");
            return;
        }
        const cells = selectedRow.cells;
        const distance = document.getElementById("distanceSelect").value;
        const stations = isNaN(distance) ? [distance] : stationMap[distance];


        const name = cells[0].textContent;
        const barcode = cells[1].textContent;
        const departure = parseDate(cells[2].textContent);
        const arrival = parseDate(cells[3 + stations.length].textContent);

        //adatok betöltése a kiválasztott sorból
        document.getElementById("edit-name").value = name;
        document.getElementById("edit-barcode").value = barcode;
        document.getElementById("edit-departure").value = departure;
        document.getElementById("edit-arrival").value = arrival;

        const stationFields = document.getElementById("station-fields");
        stationFields.innerHTML = "";

        stations.forEach((stationKey, i) => {
            const label = document.createElement("label");
            label.textContent = stationLabels[stationKey];
            label.setAttribute("for", `edit-${stationKey}`);

            const input = document.createElement("input");
            input.type = "datetime-local";
            input.name = stationKey;
            input.id = `edit-${stationKey}`;
            input.value = parseDate(cells[3 + i].textContent);

            stationFields.appendChild(label);
            stationFields.appendChild(input);
        });

        modal.style.display = "block";

    });


    function parseDate(dateString) {
        if (!dateString || dateString === "—") return "";
        let parts = dateString.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.\s*(\d{1,2}):(\d{2})/);
        if (!parts) return "";
        let [_, year, month, day, hour, minute] = parts;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
    }
        
    

    editForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const name = document.getElementById("edit-name").value;
        const barcode = document.getElementById("edit-barcode").value;
        const departure = document.getElementById("edit-departure").value || null;
        const arrival = document.getElementById("edit-arrival").value || null;
        const distance = document.getElementById("distanceSelect").value;
        const stations = stationMap[distance];

        const stationData = {};
        stations.forEach(key => {
            const input = document.getElementById(`edit-${key}`);
            stationData[key] = input?.value || null;
        });
        

        try {
            const response = await fetch("/update-checkpoint-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    barcode,
                    departure,
                    arrival,
                    distance,
                    stations: stationData
                })
            });

            const result = await response.json();
            showMessage(result.message, result.status);
    
            if (result.status === "success") {
                modal.style.display = "none";
                loadCheckpointData();
            }
    
        } catch(error) {
            console.error(error);
            showMessage("Szerverhiba!", "error");
        }
    });

    // Bezárás
    closeButton.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });
});
