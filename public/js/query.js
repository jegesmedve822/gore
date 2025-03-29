let selectedHikerId = null;

document.addEventListener("DOMContentLoaded", function () {
    loadHikers();
    document.getElementById("searchInput").addEventListener("keyup", filterTable);

    setInterval(() => {
        const modal = document.getElementById("editModal");
        const isModalOpen = modal && modal.style.display === "block";
        if (!isModalOpen) {
            loadHikers();
        }
    }, 10000);
});

const messageElement = document.getElementById("message");
function showMessage(message, status) {
    messageElement.textContent = message;
    messageElement.className = status;

    setTimeout(() => {
        messageElement.textContent="";
        messageElement.className="";
    }, 4000);
}

// Adatok betöltése AJAX segítségével
function loadHikers() {
    fetch("/hikers")
        .then(response => response.json())
        .then(data => renderTable(data))
        .catch(err => console.error("Hiba az adatok betöltésekor:", err));
}

// Táblázat megjelenítése (NEM szerkeszthető!)
function renderTable(hikers) {
    let tbody = document.querySelector("#hikersTable tbody");

    if (!tbody) {
        console.error("Hiba: Nem található a <tbody> elem!");
        return;
    }

    tbody.innerHTML = "";

    hikers.forEach(hiker => {
        let row = document.createElement("tr");

        row.innerHTML = `
            <td>${hiker.id}</td>
            <td>${hiker.name}</td>
            <td>${hiker.barcode}</td>
            <td>${hiker.distance}</td>
            <td>${hiker.departure ? new Date(hiker.departure).toLocaleString("hu-HU") : "—"}</td>
            <td>${hiker.arrival ? new Date(hiker.arrival).toLocaleString("hu-HU") : "—"}</td>
            <td>${hiker.completionTime}</td>
        `;

        tbody.appendChild(row);

    });

    filterTable();

    attachRowClickEvents();

    if (selectedHikerId) {
        let rows = document.querySelectorAll("#hikersTable tbody tr");
        rows.forEach(row => {
            if (row.cells[0].textContent === selectedHikerId) {
                row.classList.add("selected");
            }
        });
    }
}

// Táblázatban történő keresés
function filterTable() {
    let input = document.getElementById("searchInput").value.toLowerCase();
    let rows = document.querySelectorAll("#hikersTable tbody tr");

    rows.forEach(row => {
        let name = row.cells[1].textContent.toLowerCase();
        let barcode = row.cells[2].textContent.toLowerCase();

        row.style.display = (name.includes(input) || barcode.includes(input)) ? "" : "none";
    });
}

function attachRowClickEvents() {
    document.querySelectorAll("#hikersTable tbody tr").forEach(row => {
        row.addEventListener("click", function () {
            // Előző kijelölés törlése
            document.querySelectorAll("#hikersTable tbody tr").forEach(r => r.classList.remove("selected"));

            // Új kijelölés
            this.classList.add("selected");

            // Kiválasztott ID mentése
            selectedHikerId = this.cells[0].textContent;
        });
    });
}

document.getElementById("export-csv").addEventListener("click", async function () {
    try {
        const response = await fetch("/export-csv");

        if(!response.ok) {
            const data = await response.json();
            showMessage(data.message, data.status);
            return;
        }
        // CSV letöltése
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "hikers_export.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showMessage("A CSV exportálás sikeres volt!", "success");
    } catch (error) {
        showMessage("Ismeretlen hiba történt.", "error");
    }
});

