document.addEventListener("DOMContentLoaded", function () {
    function fetchServerHistory() {
        fetch("/server-history")
            .then(response => response.json())
            .then(data => {
                let tableBody = document.querySelector("#serverHistoryTable tbody");
                tableBody.innerHTML = "";

                data.forEach(row => {
                    let tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>${new Date(row.timestamp).toLocaleString("hu-HU")}</td>
                        <td>${row.cpu_load}%</td>
                        <td>${row.memory_usage}%</td>
                        <td>${Math.floor(row.uptime / 60)} perc</td>
                    `;
                    tableBody.appendChild(tr);
                });
            })
            .catch(err => console.error("Hiba az adatok lekérésekor:", err));
    }

    fetchServerHistory();
    setInterval(fetchServerHistory, 30000);
});
