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

        const departureRaw = cells[2].textContent;
        const arrivalRaw = cells[3 + stations.length].textContent;



        const departureDate = selectedRow.getAttribute("data-departure-date") || "";
        const arrivalDate = selectedRow.getAttribute("data-arrival-date") || "";

        console.log("departureDate:", departureDate);
        const departureTime = parseTimeOnly(departureRaw);
        const arrivalTime = parseTimeOnly(arrivalRaw);
        console.log("departureTime:", departureTime);

        //adatok betöltése a kiválasztott sorból
        document.getElementById("edit-name").value = name;
        document.getElementById("edit-barcode").value = barcode;
        document.getElementById("edit-departure").value = departureTime;
        document.getElementById("edit-arrival").value = arrivalTime;
        document.getElementById("original-departure-date").value = departureDate;
        document.getElementById("original-arrival-date").value = arrivalDate;

        const stationFields = document.getElementById("station-fields");
        stationFields.innerHTML = "";

        stations.forEach((stationKey, i) => {
            const label = document.createElement("label");
            label.textContent = stationLabels[stationKey];
            label.setAttribute("for", `edit-${stationKey}`);

            const input = document.createElement("input");
            input.type = "time";
            input.name = stationKey;
            input.id = `edit-${stationKey}`;
            input.step = "1";
            input.value = parseTimeOnly(cells[3 + i].textContent);

            stationFields.appendChild(label);
            stationFields.appendChild(input);
        });

        modal.style.display = "block";

    });


        function getDateOnly(dateString) {
            if (!dateString || dateString === "—") return "";
        
            // ISO formátum (pl. 2024-04-12T23:59:59)
            if (dateString.includes("T")) {
                return dateString.split("T")[0];
            }
        
            // Formátum: "2024. 04. 12. 23:59:59"
            const parts = dateString.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})/);
            if (!parts) return "";
        
            const [_, year, month, day] = parts;
            return `${year}-${month}-${day}`;
        }
        
        function parseTimeOnly(dateString) {
            if (!dateString || dateString === "—") return "";
        
            // ISO formátum (pl. "2024-04-12T23:59:59")
            if (dateString.includes("T")) {
                const [_, timePart] = dateString.split("T");
                const [hour, minute, second = "00"] = timePart.split(":");
                return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
            }
        
            // Formátum: "2024. 04. 12. 23:59:59"
            const match = dateString.match(/\d{4}\.\s*\d{2}\.\s*\d{2}\.\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (match) {
                const [_, hour, minute, second = "00"] = match;
                return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
            }
        
            // Plain time string (pl. "23:40:07")
            const [hour, minute, second = "00"] = dateString.split(":");
            return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
        }
        

        

    editForm.addEventListener("submit", async function(event) {
        event.preventDefault();


        const name = document.getElementById("edit-name").value;
        const barcode = document.getElementById("edit-barcode").value;
        const distance = document.getElementById("distanceSelect").value;
        const stations = isNaN(distance) ? [distance] : stationMap[distance];



        let departureDate = document.getElementById("original-departure-date").value;
        const departureTime = document.getElementById("edit-departure").value;
        let arrivalDate = document.getElementById("original-arrival-date").value;
        const arrivalTime = document.getElementById("edit-arrival").value;

        // Ha nincs dátum, használjuk a mai napot
        const today = new Date().toISOString().split("T")[0];
        if (!departureDate && departureTime) {
            departureDate = today;
        }
        if (!arrivalDate && arrivalTime) {
            arrivalDate = today;
        }

        const departure = (departureDate && departureTime) ? `${departureDate}T${departureTime}` : null;
        const arrival = (arrivalDate && arrivalTime) ? `${arrivalDate}T${arrivalTime}` : null;


        const stationData = {};
        stations.forEach(key => {
            const input = document.getElementById(`edit-${key}`);
            const time = input?.value || null;
            stationData[key] = (time && departureDate) ? `${departureDate}T${time}` : null;
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
