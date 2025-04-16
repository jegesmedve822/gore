document.addEventListener("DOMContentLoaded", function () {
    loadHikers();

    setInterval(loadHikers, 10000);
});

// Adatok betöltése AJAX segítségével
function loadHikers() {
    fetch("/api/oklevel")
        .then(response => response.json())
        .then(hikers => {
            console.log("Beérkezett adatok:", hikers); // Debughoz hasznos
            renderTable(hikers);
        })
        .catch(err => console.error("Hiba az adatok betöltésekor:", err));
}

// Táblázat megjelenítése (NEM szerkeszthető!)
function renderTable(hikers) {
    const tbody = document.querySelector("#hikersTable tbody");

    if (!tbody) {
        console.error("Hiba: Nem található a <tbody> elem!");
        return;
    }

    tbody.innerHTML = "";

    hikers.forEach((hiker) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${hiker.name}</td>
            <td>${hiker.distance}</td>
            <td>${hiker.isInTime}</td>
            <td>${hiker.completionTime}</td>
        `;

        tbody.appendChild(row);
    });
}
