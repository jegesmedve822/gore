document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("confirmModal");
    const confirmMessage = document.getElementById("confirmMessage");
    const confirmYes = document.getElementById("confirmYes");
    const confirmNo = document.getElementById("confirmNo");
    const messageElement = document.getElementById("message");
    let currentAction = null;

    function showMessage(message, status) {
        messageElement.textContent = message;
        messageElement.className = status;

        setTimeout(() => {
            messageElement.textContent="";
            messageElement.className="";
        }, 4000);
    }

    document.querySelectorAll(".db-action").forEach(button => {
        button.addEventListener("click", function (event) {
            event.preventDefault();

            currentAction = this.dataset.action;
            if(!currentAction) return
            confirmMessage.textContent = `Biztosan végrehajtod ezt a műveletet: ${currentAction.toUpperCase()}?`;
            modal.style.display = "block";
        });
    });

    confirmNo.addEventListener("click", function () {
        modal.style.display = "none";
    });

    confirmYes.addEventListener("click", async function () {
        if (!currentAction) return;
        
        try {
            const response = await fetch(`/db-action/${currentAction}`, { method: "POST" });
            const data = await response.json();
            //alert(data.message); // Ezt később lecserélheted egy szebb UI értesítésre
            showMessage(data.message, data.status);
        } catch (error) {
            //alert("Hiba történt a művelet végrehajtása során.");
            showMessage(data.message, data.status);
        }

        modal.style.display = "none";
    });

    modal.style.display = "none";
});
