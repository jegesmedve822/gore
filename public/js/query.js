document.addEventListener("DOMContentLoaded", function () {
    loadHikers();
    document.getElementById("searchInput").addEventListener("keyup", filterTable);
});

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
            <td>${hiker.departure ? new Date(hiker.departure).toLocaleString("hu-HU") : "—"}</td>
            <td>${hiker.arrival ? new Date(hiker.arrival).toLocaleString("hu-HU") : "—"}</td>
        `;

        tbody.appendChild(row);
    });
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
