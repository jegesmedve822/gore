const startButton = document.getElementById('start-camera-scan');
const stopButton = document.getElementById('stop-camera-scan');
const cameraContainer = document.getElementById('camera-container');
const videoElement = document.getElementById('scanner');
const barcodeInput = document.getElementById('barcode');
const cameraStatus = document.getElementById('camera-status');

let isScannerRunning = false;

function startScanner() {
    if (isScannerRunning) {
        return;
    }

    cameraStatus.textContent = 'Kamera indítása...';

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.getElementById('scanner'),
            constraints: {
                facingMode: "environment"
            },
        },
        decoder: {
            readers: ["ean_8_reader"]
        },
    }, function (err) {
        if (err) {
            console.error('Quagga init hiba:', err);
            cameraStatus.textContent = 'Hiba a kamera elindításakor.';
            return;
        }
        
        console.log('Quagga.cameraAccess:', Quagga.cameraAccess);
        if (Quagga.cameraAccess && Quagga.cameraAccess.stream) {
            console.log('✅ Kamera stream elérhető:', Quagga.cameraAccess.stream);
        } else {
            console.warn('⚠️ Nincs kamera stream a Quaggában!');
        }
        
        Quagga.start();
        isScannerRunning = true;
        cameraStatus.textContent = 'Kamera fut. Várakozás vonalkódra...';
        
    });
    

    Quagga.onDetected(onBarcodeDetected);
}

// Vonalkód beolvasás kezelése
function onBarcodeDetected(data) {
    const code = data.codeResult.code;
    console.log('Vonalkód beolvasva:', code);

    // Beírjuk a form mezőbe
    barcodeInput.value = code;

    // Jelzés a usernek
    cameraStatus.textContent = `Beolvasott kód: ${code}`;

    // Automatikus leállítás (ha szeretnéd folyamatos olvasás helyett)
    stopScanner();

    //nem kell a konténer sem
    cameraContainer.style.display="none";
}

// Leállítja a QuaggaJS-t
function stopScanner() {
    if (isScannerRunning) {
        Quagga.stop();
        isScannerRunning = false;
        cameraStatus.textContent = 'Kamera leállítva.';

        // Kamera stream kézi leállítása
        if (Quagga.cameraAccess && Quagga.cameraAccess.stream) {
            console.log('🔧 Kamera stream leállítása...');
            Quagga.cameraAccess.stream.getTracks().forEach(track => {
                track.stop();
            });
        }
    }
}


// Eseménykezelők
startButton.addEventListener('click', () => {
    cameraContainer.style.display = 'block';
    startScanner();
});

stopButton.addEventListener('click', () => {
    cameraContainer.style.display = 'none';
    stopScanner();
});