document.addEventListener("DOMContentLoaded", function () {
    function fetchServerStatus() {
        fetch("/server-status")
            .then(response => {
                if (response.status === 403) {
                    console.warn("Nincs jogosultságod a szerver állapotának lekérésére.");
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (!data) return;

                document.getElementById("cpuLoad").textContent = data.cpuLoad;
                document.getElementById("memoryUsage").textContent = data.memoryUsage;
                document.getElementById("freeMemory").textContent = data.freeMemory;
                document.getElementById("totalMemory").textContent = data.totalMemory;
                document.getElementById("uptime").textContent = data.uptime;
            })
            .catch(err => console.error("Hiba a szerver állapot lekérésekor:", err));
    }

    fetchServerStatus(); // Első betöltéskor
    setInterval(fetchServerStatus, 5000); // Frissítés 5 másodpercenként
});
