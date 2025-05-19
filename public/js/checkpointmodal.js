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

        const departure = selectedRow.getAttribute("data-departure") || "";
        const arrival = selectedRow.getAttribute("data-arrival") || "";


        const departureRaw = cells[2].textContent;
        const arrivalRaw = cells[3 + stations.length].textContent;



        const departureDate = selectedRow.getAttribute("data-departure-date") || "";
        const arrivalDate = selectedRow.getAttribute("data-arrival-date") || "";

        console.log("departureDate:", departureDate);
        const departureTime = parseDateTimeLocal(departureRaw);
        const arrivalTime = parseDateTimeLocal(arrivalRaw);
        console.log("departureTime:", departureTime);

        //adatok betöltése a kiválasztott sorból
        document.getElementById("edit-name").value = name;
        document.getElementById("edit-barcode").value = barcode;
        //document.getElementById("edit-departure").value = parseDateTimeLocal(departureDate);
        //document.getElementById("edit-arrival").value = parseDateTimeLocal(arrivalDate);
        document.getElementById("edit-departure").value = parseDateTimeLocal(departure);
        document.getElementById("edit-arrival").value = parseDateTimeLocal(arrival);
        //document.getElementById("original-departure-date").value = departureDate;
        document.getElementById("original-arrival-date").value = arrivalDate;

        const stationFields = document.getElementById("station-fields");
        stationFields.innerHTML = "";

        stations.forEach((stationKey, i) => {
            console.log("Cell value:", cells[3 + i].textContent);
            const label = document.createElement("label");
            label.textContent = stationLabels[stationKey];
            label.setAttribute("for", `edit-${stationKey}`);

            const input = document.createElement("input");
            input.type = "datetime-local";
            input.name = stationKey;
            input.id = `edit-${stationKey}`;
            input.step = "1";
            //input.value = parseDateTimeLocal(cells[3 + i].textContent);
            const timestamp = selectedRow.getAttribute(`data-${stationKey}`) || "";
            input.value = parseDateTimeLocal(timestamp);


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

        //const departure = (departureDate && departureTime) ? `${departureDate}T${departureTime}` : null;
        //const arrival = (arrivalDate && arrivalTime) ? `${arrivalDate}T${arrivalTime}` : null;

        const departure = document.getElementById("edit-departure").value || null;
        const arrival = document.getElementById("edit-arrival").value || null;
        console.log("MODAL RAW DEPARTURE:", departure);
        console.log("typeof departure:", typeof departure);
        const parsed = parseDateTimeLocal(departure);
        console.log("INPUT VALUE LESZ:", parsed);
        document.getElementById("edit-departure").value = parsed;





        const stationData = {};
        stations.forEach(key => {
            const input = document.getElementById(`edit-${key}`);
            const time = input?.value || null;
            //stationData[key] = (time && departureDate) ? `${departureDate}T${time}` : null;
            stationData[key] = time || null;

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
            console.log("STATIONDATA POSZTHOZ:", JSON.stringify(stationData));


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
