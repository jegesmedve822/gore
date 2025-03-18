import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import ejs from "ejs";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import dotenv from "dotenv";
import { isAuthenticated, isSysAdmin, isUser, isViewer } from "./middlewares/authMiddleware.js";
import os from "os";
import fs from "fs";
import { Parser } from "json2csv";




const app = express();
const port = 3001;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
const saltRounds = 10;
dotenv.config();

//Public mappa hozzáadása
app.use(express.static("public"));

//Új session létrehozása, mindig a passport előtt kell lennie!
app.use(
    session({
        secret: "Q6zx226x",
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 1000*60*60*24,
        }
    })
);

//passport létrehozás
app.use(passport.session());

// Kapcsolódás az adatbázishoz
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});
db.connect();

// BodyParser használat az userformhoz
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.render("login.ejs")
});

//főoldal megjelenítése
app.get("/main", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("main.ejs");
    } else {
        res.redirect("/");
    }
});

app.get("/admin", isSysAdmin, (req, res) => {
    res.render("admin.ejs", { user: req.user });
});



app.get("/regisztracio", isUser, (req, res) => {
    res.render("register.ejs", { user: req.user });
});



app.get("/inditas", isUser, (req, res) => {
    res.render("start.ejs", { user: req.body.user });
})



app.get("/modositas", isViewer, (req, res) => {
    res.render("query.ejs", { user: req.body.user });
});

//Bejelentkezés az oldalra
app.post("/login", passport.authenticate("local", {
    successRedirect: "/main",
    failureRedirect: "/"
}));

//kijelentkezés
app.get("/logout", isViewer, (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.redirect("/");
        });
    });
});

passport.use(new Strategy(async function verify(username, password, cb){
    try {
        const result = await db.query("SELECT * FROM sys_users WHERE user_name = $1",
            [username]);
        if(result.rows.length > 0) {
            const user = result.rows[0];
            const storedHashedPassword = user.password;

            //Összehasonlítjuk a hash értékeket
            bcrypt.compare(password, storedHashedPassword, (err, result) => {
                if(err) {
                    return cb(err);
                } else {
                    if(result) {
                        return cb(null, user);
                    } else {
                        return cb(null, false);
                    }
                }
            });
        } else {
            return cb("Nem található felhasználó ezen a néven!");
        }
    } catch(err) {
        return cb(err);
    }
})
);


passport.serializeUser((user, cb) => {
    cb(null, user);
});


passport.deserializeUser((user, cb) => {
    cb(null, user);
});

//checksum ellenőrző függvény
function isValidEAN8(barcode) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
        let digit = parseInt(barcode[i], 10);
        sum += (i % 2 === 0) ? digit * 3 : digit;
    }

    let checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(barcode[7], 10);
}

let lastInsertedId = null;

//túrázó beszúrása az adatbázisba a userformról
app.post("/registerhiker", isUser, async (req, res)=> {
    const name = req.body.name;
    const distance = req.body.distance;
    const barcode = req.body.barcode;

    if(!isValidEAN8(barcode)) {
        return res.json({ message: "A vonalkód NEM felel meg az EAN-8 szabványnak!", status: "error" });
    }

    //ne legyen duplikált vonalkód
    try {
        const checkResult = await db.query("SELECT * FROM hikers WHERE barcode = $1",
            [barcode]);
        if(checkResult.rows.length > 0) {
            return res.json({ message: "A vonalkód már létezik az adatbázisban, adj meg másikat!", status: "error" });
        } else {
            const result = await db.query("INSERT INTO hikers (name, distance, barcode) VALUES($1, $2, $3) RETURNING id",
                [name, distance, barcode]
            );

            lastInsertedId = result.rows[0].id;
            res.json({ message: "A rekord sikeresen hozzáadva az adatbázishoz!", status: "success" });
        }
    } catch(err) {
        console.log(err);
        res.json({ message: "Hiba történt az adatbázis művelet során!", status: "error" });
    }
});

//utolsó rekord törlése az adatbázisból
app.post("/undo", isUser, async (req, res) => {
    try {
        if(!lastInsertedId) {
            return res.json({ message: "Nincs törölhető rekord!", status: "error", canUndo: false });
        }

        await db.query("DELETE FROM hikers WHERE id = $1", [lastInsertedId]);
        lastInsertedId = null;

        res.json({ message: "Az utolsó rekord sikeresen visszavonva!", status: "success", canUndo: false });

    } catch (err) {
        console.log(err);
        res.json({ message: "Hiba történt a visszavonás során!", status: "error", canUndo: false });
    }
});

//--------------------------------------innentől jönnek a második fül funkciói------------------------------
app.post("/recordtimestamp", isUser, async (req, res) => {
    const barcode = req.body.barcode;

    try{
        //megnézzük, hogy a vonalkód létezik-e az adatbázisban
        const checkResult = await db.query("SELECT * FROM hikers WHERE barcode = $1", 
            [barcode]);
        if(checkResult.rows.length === 0) {
            return res.json({ message: "A beolvasott vonalkód NINCS regisztrálva az adatbázisban!", status: "error" });
        }

        //Megnézzük, hogy a departure date létezik-e az adatbázisban
        const departureValue = await db.query("SELECT departure FROM hikers WHERE barcode = $1",
            [barcode]);
        
        //ha nem, akkor beállítjuk az indulási időnek a currentdatet
        if(departureValue.rows.length > 0 && departureValue.rows[0].departure === null) {
            const currentDate = new Date();
            await db.query("UPDATE hikers SET departure = $1 WHERE barcode = $2",
                [currentDate, barcode]);
            return res.json({ message: "Az INDULÁSI dátum sikeresen rögzítve az adatbázisban!", status: "success" });
        }
        //Ha a dátum benne van a departure mezőben, akkor megnézzük, hogy eltelt-e a rögzítés óta 20 perc. Ha nem, nem szúrjuk be az új rekordot, ha igen, beszúrjuk az arrival dátumnak.
        if(departureValue.rows.length > 0 && departureValue.rows[0].departure !== null) {
            //megnézzük, hogy az arrival dátum töltve van-e
            if(checkResult.rows[0].arrival === null) {
                const departureDate = departureValue.rows[0].departure;
                const currentDate = new Date();

                //a departure date és a current date közti különbség percekben
                const dateDiff = (currentDate - new Date(departureDate))/(1000*60);

                //ha x perc nem telt el, ne illessze be a rekordot
                if(dateDiff < 1)  {
                    return res.json({ message: "Nem telt el x perc az elindulás óta, ezért az érkezési időpont NEM került beillesztésre!", status: "error" });
                } else {
                    //Arrival dátum beillesztése az adatbázisba
                    await db.query("UPDATE hikers SET arrival = $1 WHERE barcode = $2",
                        [currentDate, barcode]);
                    
                    //a versenyző nevének lekérdezése teljsítési idő kiszámítása és a változó megjelenítése az oldalon.
                    const hikerName = checkResult.rows[0].name;

                    //idő kiszámítása és megfelelő formátumba hozása
                    const diffMs = currentDate - new Date(departureDate);
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                    const completionTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
                    
                    return res.json({ 
                        message: "Az ÉRKEZÉSI idő sikeresen rögzítve az adatbázisba!",
                        status: "success",
                        completion: completionTime, 
                        hikerName: hikerName
                    });
                }
            } else {
                const hikerName = checkResult.rows[0].name;
                return res.json({ 
                    message: "A versenyző érkezése már korábban regisztrálásra került!",
                    status: "error",
                    hikerName: hikerName
                });
            }
        }
    } catch(err) {
        res.json({ message: "Hiba történt az adatbázisművelet során!", status: "error" });
    }
});

//--------------------innentől a lekérdezési/módosítási panel fog következni-------------------------------------
app.get("/hikers", isViewer, async (req, res) => {
    if(req.isAuthenticated()) {
        try {
            const result = await db.query("SELECT * FROM hikers ORDER BY distance, id ASC");

            //új tömb, ami megadja a teljesítési időt, ha az létezik
            const hikersWithCompletionTime = result.rows.map(hiker => {
                let completionTime = "Még nem indult el";

                if(hiker.departure && !hiker.arrival) {
                    completionTime = "Még nem érkezett be";
                } else if (hiker.departure && hiker.arrival) {
                    const diffMs = new Date(hiker.arrival) - new Date(hiker.departure);
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                    completionTime = `${hours} óra ${minutes} perc ${seconds} mp`;
                }

                return { ...hiker, completionTime };
            });

            res.json(hikersWithCompletionTime);
        } catch (err) {
            res.status(500).json({ message: "Hiba az adatok betöltésekot.", status: "error" });
        };
    } else {
        res.redirect("/");
    }
});

//a módosítás funkciója
app.post("/update", isUser, async (req, res) => {
    if(req.isAuthenticated()) {
        const { id, name, barcode, departure, arrival } = req.body;

        try {
            const result = await db.query("SELECT departure, arrival FROM hikers WHERE id = $1", [id]);
            const existingDeparture = result.rows[0].departure;
            const existingArrival = result.rows[0].arrival;

            const safeDeparture = departure && departure !== "" ? departure : existingDeparture;
            const safeArrival = arrival && arrival !== "" ? arrival : existingArrival;


            await db.query(
                "UPDATE hikers SET name = $1, barcode = $2, departure = $3, arrival = $4 WHERE id = $5",
                [name, barcode, departure || null, arrival ||null, id]
            );
            res.json({ message: "Sikeresen frissítve!", status: "success" });
        } catch(err) {
            res.status(500).json({ message: "Hiba történt az adatmódosítás során.", status: "error" });
        }
    } else {
        res.redirect("/");
    }
});



//adatok exportálása .csv-be
app.get("/export-csv", isViewer, async (req, res)=> {
    try {
        const result = await db.query("SELECT * FROM hikers ORDER BY id ASC");
        const hikers = result.rows;

        if(hikers.length === 0) {
            return res.status(404).json({ message: "Nincsenek adatok az exporthoz!", status: "error" });
        }

        const csvFields = ["id", "name", "barcode", "distance", "departure", "arrival"];
        const json2csvParser = new Parser({ fields: csvFields });
        const csvData = json2csvParser.parse(hikers);

        const filePath = "exports/hikers_export.csv";
        fs.writeFileSync(filePath, csvData, "utf-8");

        res.download(filePath, "hikers_export.csv", () => {
            fs.unlinkSync(filePath); // Letöltés után töröljük a fájlt
        });
    } catch(err) {
        console.error("Hiba történt az exportálás során:", err);
        res.status(500).json({ message: "Hiba történt az exportálás során!", status: "error" });
    }
});

//--------------------------------------------------admin panel jön-----------------------------------------------------------
app.post("/create-sysuser", isSysAdmin, async (req, res) => {
    if(req.isAuthenticated()) {
        const username = req.body.username;

        try {
            if(req.body.action === "create") {
                const checkUsername = await db.query("SELECT user_name FROM sys_users WHERE user_name = $1", [username]);

                if(checkUsername.rows.length > 0) {
                    return res.json({ message: "Ez a felhasználónév már létezik az adatbázisban", status: "error" });
                } else {
                    const email = req.body.email;
                    const role = req.body.role;
                    const password = req.body.password;
                    const password_hash = await bcrypt.hash(password, saltRounds);

                    await db.query("INSERT INTO sys_users (user_name, user_email, password, role) VALUES($1, $2, $3, $4)", [username, email, password_hash, role]);
                    return res.json({ message: "A felhasználó sikeresen létrehozva!", status: "success" });
                }
            } if(req.body.action==="delete") {
                const checkUsername = await db.query("SELECT user_name FROM sys_users WHERE user_name = $1", [username]);

                if(checkUsername.rows.length === 0) {
                    return res.json({ message: "A beírt felhasználónév nem található az adatbázisban!", status: "error" });

                } else {
                    await db.query("DELETE FROM sys_users WHERE user_name = $1", [username]);
                    return res.json({ message: "A felhasználó sikeresen törölve az adatbázisból", status: "success" });
                }

            } if(req.body.action==="update") {
                const checkUsername = await db.query("SELECT user_name FROM sys_users WHERE user_name = $1", [username]);

                if(checkUsername.rows.length === 0) {
                    return res.json({ message: "A beírt felhasználónév nem található az adatbázisban!", status: "error" });

                } else {
                    const role = req.body.role;
                    await db.query("UPDATE sys_users SET role = $1 WHERE user_name = $2", [role, username]);
                    return res.json({ message: "A felhasználó szerepköre sikeresen módosult.", status:"success" });
                }
            }
        } catch(err) {
            res.status(500).json({ message: "Hiba történt az adatbázisművelet során!", status: "error" });
        }
    } else {
        res.redirect("/");
    }
});

//szerver leterheltsége a frontenden való mutatása
app.get("/server-status", isSysAdmin, (req, res) => {
    const cpuLoad = os.loadavg()[0];
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    const uptime = os.uptime();

    res.json({
        cpuLoad: cpuLoad.toFixed(2),
        memoryUsage: memoryUsage.toFixed(2),
        freeMemory: (freeMemory / 1024 / 1024).toFixed(2), // MB
        totalMemory: (totalMemory / 1024 / 1024).toFixed(2), // MB
        uptime: Math.floor(uptime / 60) + " perc"
    });

});

async function saveServerStats() {
    try {
        const cpuLoad = os.loadavg()[0]; 
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = (usedMemory / totalMemory) * 100;
        const uptime = os.uptime();

        await db.query(
            "INSERT INTO server_stats (cpu_load, memory_usage, free_memory, total_memory, uptime) VALUES ($1, $2, $3, $4, $5)",
            [cpuLoad.toFixed(2), memoryUsage.toFixed(2), (freeMemory / 1024 / 1024).toFixed(2), (totalMemory / 1024 / 1024).toFixed(2), Math.floor(uptime)]
        );

    } catch(err) {
        console.error("Hiba a szerver állapot mentése közben:", err);
    }
}

setInterval(saveServerStats, 30000);

//szerver historynak a megjelenítése:
app.get("/server-history", isSysAdmin, async(req, res) => {
    try {
        const result = await db.query("SELECT * FROM server_stats ORDER BY timestamp DESC LIMIT 60");
        res.json(result.rows);
    } catch(err) {
        res.status(500).json({ message:"Hiba a szerver állapot lekérése közben.", status: "error", });
    }
});

//db tisztítások, trükközések
app.post("/db-action/:action", isSysAdmin, async (req, res) => {
    const { action } = req.params;

    try {
        let query = "";
        if (action === "backup") query = "CALL archive_hikers()";
        else if (action === "restore") query = "CALL restore_hikers()";
        else if (action === "purge") query = "DELETE FROM hikers ";
        else return res.status(400).json({ message: "Érvénytelen művelet!", status: "error" });

        await db.query(query);
        res.json({ message: `A ${action.toUpperCase()} művelet sikeresen lefutott!`, status: "success" });

    } catch (error) {
        console.error("DB művelet hiba:", error);
        res.status(500).json({ message: "Hiba történt az adatbázisművelet során!", status: "error" });
    }
});


// Szerver futtatása
app.listen(port, () => {
    console.log(`App is running on port ${port}.`);
});
