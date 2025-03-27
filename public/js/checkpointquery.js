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
document.addEventListener("DOMContentLoaded", () => {
    const distanceSelect = document.getElementById("distanceSelect");
    const searchInput = document.getElementById("searchInput");

    distanceSelect.addEventListener("change", () => {
        loadCheckpointData();
    });

    searchInput.addEventListener("keyup", () => {
        filterTable();
    });

    // Első betöltés
    loadCheckpointData();
});

function loadCheckpointData() {
    const distance = document.getElementById("distanceSelect").value;
    const stations = stationMap[distance];

    // Frissítjük a fejlécet
    const headerRow = document.getElementById("table-header");
    headerRow.innerHTML = `
        <th>Név</th>
        <th>Vonalkód</th>
        <th>Indulás</th>
        ${stations.map(s => `<th>${stationLabels[s]}</th>`).join("")}
        <th>Érkezés</th>
        <th>Státusz</th>
    `;

    // Most POST-ot küldünk a szervernek
    fetch("/get-checkpoint-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distance })
    })
    .then(res => res.json())
    .then(data => renderTableRows(data, stations))
    .catch(err => console.error("Hiba az adatok betöltésekor:", err));
}


function renderTableRows(data, stations) {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    data.forEach(hiker => {
        const row = document.createElement("tr");

        const lastCheckpointLabel = stationLabels[hiker.completionTime] || hiker.completionTime;

        row.innerHTML = `
            <td>${hiker.name}</td>
            <td>${hiker.barcode}</td>
            <td>${formatDate(hiker.departure)}</td>
            ${stations.map(st => `<td>${formatDate(hiker[st])}</td>`).join("")}
            <td>${formatDate(hiker.arrival)}</td>
            <td>${lastCheckpointLabel}</td>
        `;

        tbody.appendChild(row);
    });
}

function formatDate(dateString) {
    return dateString ? new Date(dateString).toLocaleString("hu-HU") : "—";
}

function filterTable() {
    const filter = document.getElementById("searchInput").value.toLowerCase();
    const rows = document.querySelectorAll("#table-body tr");

    rows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const barcode = row.cells[1].textContent.toLowerCase();
        row.style.display = name.includes(filter) || barcode.includes(filter) ? "" : "none";
    });
}


document.getElementById("export-csv").addEventListener("click", async function () {
    try {
        const response = await fetch("/export-csv-checkpoints");

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