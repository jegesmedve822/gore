import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import ejs from "ejs";
import bcryptjs from "bcryptjs";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import dotenv from "dotenv";
import { isAuthenticated, isSysAdmin, isUser, isViewer, isStarter, isCheckpoint, isCoreUser } from "./middlewares/authMiddleware.js";
import os from "os";
import fs from "fs";
import { Parser } from "json2csv";
import nodemailer from "nodemailer";
import { stationColumns, referenceTimes } from "./middlewares/config/stationConfig.js";




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

//nodemailer beállítások
async function sendEmail(toEmail, username, password) {
    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        service: process.env.EMAIL_PROVIDER,
        auth: {
            user: process.env.EMAIL_SENDER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_SENDER,
        to: toEmail,
        subject: "Göre-app felhasználói fiókod létrejött!",
        text: `Szia!\n\n A Göre apphoz tartozó felhasználói fiókod létrejött!\n\nBejelentkezési adatok:\nFelhasználónév: ${username}\nJelszó: ${password}\n\nJó munkát!`
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log("Email sikeresen elküldve!");
    } catch(error) {
        console.error("Email küldési hiba:", error);
    }
    
}


//főoldal megjelenítése
app.get("/main", isCoreUser, (req, res) => {
    res.render("main.ejs");
});

app.get("/admin", isSysAdmin, (req, res) => {
    res.render("admin.ejs", { user: req.user });
});



app.get("/regisztracio", isUser, (req, res) => {
    res.render("register.ejs", { user: req.user });
});



app.get("/inditas",isStarter, (req, res) => {
    res.render("start.ejs", { user: req.body.user });
});



app.get("/modositas", isViewer, (req, res) => {
    res.render("queries.ejs", { user: req.body.user });
});

app.get("/torzsadatok", isViewer, (req, res) => {
    res.render("query.ejs", { user: req.body.user });
});

app.get("/reszletesadatok", isViewer, (req, res) => {
    res.render("mapquery.ejs", { user: req.body.user });
});

app.get("/oklevel", isViewer, (req, res) => {
    res.render("administrative.ejs", { user: req.body.user });
});

//checkpoint oldal megjelenítése
app.get("/checkpoint", isCheckpoint, (req, res) => {
    const role = req.user.role.toLowerCase();
    const checkpointKey = role.replace("c-","");

    const checkpointNames = {
        piroshaz: "Piros ház",
        gyugy: "Gyugy",
        gorekilato: "Göre-kilátó",
        kishegy: "Kishegy",
        harsaspuszta: "Hársas-puszta",
        bendekpuszta: "Béndek-puszta"
    }

    const checkpointName = checkpointNames[checkpointKey];

    res.render("checkpoint.ejs", {
        username: req.user.user_name,
        checkpointRole: role,
        checkpointName
    });
});


app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if(err) return next(err);
        if(!user) return res.redirect("/");

        req.logIn(user, (err) => {
            if (err) return next(err);

            const role = user.role;

            if(role.startsWith("c-")) {
                return res.redirect("/checkpoint");
            }

            return res.redirect("/main");
        });
    })(req, res, next);
});

//kijelentkezés
app.get("/logout", isAuthenticated, (req, res) => {
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
            bcryptjs.compare(password, storedHashedPassword, (err, result) => {
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
    const phoneNumber = req.body.phone;

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
            const result = await db.query("INSERT INTO hikers (name, distance, barcode, phone_number) VALUES($1, $2, $3, $4) RETURNING id",
                [name, distance, barcode, phoneNumber]
            );

            lastInsertedId = result.rows[0].id;
            res.json({ message: "A rekord sikeresen hozzáadva az adatbázishoz!", status: "success" });
        }
    } catch(err) {
        console.log(err);
        res.json({ message: "Hiba történt az adatbázis művelet során!", status: "error" });
    }
});


//--------------------------------------innentől jönnek a második fül funkciói------------------------------
app.post("/recordtimestamp", isStarter, async (req, res) => {
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
            const hikerName = checkResult.rows[0].name;
            const currentDate = new Date();
            await db.query("UPDATE hikers SET departure = $1 WHERE barcode = $2",
                [currentDate, barcode]);
            return res.json({ message: "Az INDULÁSI dátum sikeresen rögzítve az adatbázisban!", status: "success", hikerName: hikerName });
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
                if(dateDiff < 15)  {
                    return res.json({ message: "Nem telt el 15 perc az elindulás óta, ezért az érkezési időpont NEM került beillesztésre!", status: "error" });
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
                    
                    let isInTime = 'notin';
                    //távolság lekérdezése az adatbázisból
                    const distance = checkResult.rows[0].distance;
                    if ((distance == 12 && hours < 5) ||
                        (distance == 24 && hours < 7) ||
                        (distance == 34 && hours < 9)) {
                            isInTime = 'in';
                    }
                    
                    return res.json({ 
                        message: "Az ÉRKEZÉSI idő sikeresen rögzítve az adatbázisba!",
                        status: "success",
                        completion: completionTime, 
                        hikerName: hikerName,
                        isInTime: isInTime
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
            const checkpointResult = await db.query("SELECT * FROM checkpoints");
            const hikerSatistics = await db.query(
                `SELECT
                    COUNT(*) FILTER (
                        WHERE arrival IS NOT NULL
                        AND date(arrival) != '9999-12-31'
                        AND date(departure) != '9999-12-31'
                        ) AS hikers_arrived
                    ,COUNT(*) FILTER(
                        WHERE (arrival IS NULL OR date(arrival) != '9999-12-31')
                        AND date(departure) != '9999-12-31'
                    ) AS hikers_total
                FROM
                    hikers
                `
            );

            const hikersArrived = hikerSatistics.rows[0].hikers_arrived;
            const hikersTotal = hikerSatistics.rows[0].hikers_total;

            const hikersWithCompletionTime = result.rows.map(hiker => {
                let completionTime = "Még nem indult el";

                const departureDate = hiker.departure ? new Date(hiker.departure) : null;
                const arrivalDate = hiker.arrival ? new Date(hiker.arrival) : null;

                // ÚJ: Feladás ellenőrzés
                const getTimePart = (date) => date?.toTimeString().split(" ")[0];
                const isDroppedOut =
                    (departureDate && getTimePart(departureDate) === "00:00:00") ||
                    (arrivalDate && getTimePart(arrivalDate) === "00:00:00");

                if (isDroppedOut) {
                    completionTime = "Feladta";
                } else if (departureDate && !arrivalDate) {
                    //itt adjuk meg az állomás logikáját
                    const selectedStations = stationColumns[hiker.distance] || [];
                    const checkpointRow = checkpointResult.rows.find(c => c.barcode === hiker.barcode);

                    if(!checkpointRow) {
                        completionTime = "Elindult";
                    } else {
                        for (let i = selectedStations.length -1; i >= 0; i--) {
                            const stationKey = selectedStations[i];
                            if (checkpointRow[stationKey]) {
                                completionTime = stationKey;
                                break;
                            }
                        }
                    }
                } else if (departureDate && arrivalDate) {
                    const diffMs = arrivalDate - departureDate;
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                    completionTime = `${hours} óra ${minutes} perc ${seconds} mp`;
                }
                return { ...hiker, completionTime };
            });

            res.json({
                hikers: hikersWithCompletionTime,
                hikersArrived,
                hikersTotal
            });

        } catch (err) {
            res.status(500).json({ message: "Hiba az adatok betöltésekor.", status: "error" });
        };
    } else {
        res.redirect("/");
    }
});

app.get("/api/oklevel", isViewer, async (req, res) => {
    try {
        const query = await db.query(`
            SELECT
                name
                ,distance
                ,departure
                ,arrival
            FROM hikers
            WHERE arrival IS NOT NULL
            ORDER BY arrival DESC`
        );

        const inTime = {
            12: 5 * 60,
            24: 7 * 60,
            34: 10 * 60
        };

        const result = query.rows.map(row => {
            const departure = new Date(row.departure);
            const arrival = new Date(row.arrival);


            const diffMs = arrival - departure;
            const minutes = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            const completionTime = `${hours} óra ${remainingMinutes} perc ${seconds} mp`

            const maxMinutes = inTime[row.distance];
            const success = minutes <= maxMinutes;
            const isInTime = success ? "Szintidőn belül" : "Szintidőn kívül";

            return {
                name: row.name,
                distance: `${row.distance} km`,
                completionTime,
                isInTime,
                success
            };
        });

        res.json(result);
    
    } catch(err) {
        console.error("Hiba az oklevél lekérdezésénél:", err);
    }   
});


//a módosítás funkciója
app.post("/update", isUser, async (req, res) => {
    if(req.isAuthenticated()) {
        const { id, name, barcode, distance, phone, departure, arrival } = req.body;
        console.log(req.body);


        try {
            const result = await db.query("SELECT departure, arrival FROM hikers WHERE id = $1", [id]);
            const existingDeparture = result.rows[0].departure;
            const existingArrival = result.rows[0].arrival;

            const safeDeparture = departure && departure !== "" ? departure : existingDeparture;
            const safeArrival = arrival && arrival !== "" ? arrival : existingArrival;


            await db.query(
                "UPDATE hikers SET name = $1, barcode = $2, distance = $3, phone_number = $4, departure = $5, arrival = $6 WHERE id = $7",
                [name, barcode, distance, phone, safeDeparture || null, safeArrival ||null, id]
            );
            res.json({ message: "Sikeresen frissítve!", status: "success" });
        } catch(err) {
            res.status(500).json({ message: "Hiba történt az adatmódosítás során.", status: "error" });
            console.error("UPDATE ERROR:", err);

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
                    const password_hash = await bcryptjs.hash(password, saltRounds);

                    await db.query("INSERT INTO sys_users (user_name, user_email, password, role) VALUES($1, $2, $3, $4)", [username, email, password_hash, role]);

                    //email kiküldése
                    sendEmail(email, username, password)
                    .then(()=> {
                    })
                    .catch(error=> {
                    });

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

//checkpointról történő adatbevitel
app.post("/checkpointinsert", isCheckpoint, async (req, res) => {
    const role = req.user.role;
    const input = req.body.barcode;
    const timestamp = new Date();

    const columnDictionary = {
        "c-piroshaz": "piros_haz",
        "c-gyugy": "gyugy",
        "c-gorekilato": "gore_kilato",
        "c-kishegy": "kishegy",
        "c-harsaspuszta": "harsas_puszta",
        "c-bendekpuszta": "bendek_puszta"
    };

    const column = columnDictionary[role];

    if (!column) {
        return res.status(400).json({ message: "Ismeretlen checkpoint szerepkör!", status: "error" });
    }

    try {
        const hikerResult = await db.query("SELECT barcode, distance FROM hikers WHERE barcode = $1", [input]);
        if (hikerResult.rows.length === 0) {
            return res.json({ message: "A beírt vonalkóddal NEM történt regisztráció", status: "error" });
        }

        const hikerDistance = hikerResult.rows[0].distance;
        const allowedStations = stationColumns[hikerDistance];

        if(!allowedStations.includes(column)) {
            return res.json({ message: `Ez az állomás nem része a ${hikerDistance} km-es távnak!`,
            status: "error" });
        }

        const checkpointData = await db.query(`SELECT ${column} FROM checkpoints WHERE barcode = $1`, [input]);

        if (checkpointData.rows.length === 0) {
            // Új rekord beszúrása
            const insertQuery = `INSERT INTO checkpoints (barcode, ${column}) VALUES ($1, $2)`;
            await db.query(insertQuery, [input, timestamp]);
            return res.json({ message: "Az érkezési idő sikeresen beillesztve!", status: "success" });
        }

        const existingValue = checkpointData.rows[0][column];

        if (existingValue != null) {
            return res.json({ message: "A dátum korábban már rögzítve lett!", status: "error" });
        }

        const updateQuery = `UPDATE checkpoints SET ${column} = $1 WHERE barcode = $2`;
        await db.query(updateQuery, [timestamp, input]);
        return res.json({ message: "Az érkezési idő sikeresen beillesztve", status: "success" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Szerverhiba!", status: "error" });
    }
});


//ada megjelenítése
app.post("/get-checkpoint-data", isViewer, async (req, res) => {
    const distance = req.body.distance;


    if(!isNaN(distance)) {
        const numericDistance = parseInt(distance);
        const selectedStations = stationColumns[distance];
        const selectedColumns = selectedStations.join(", ");

        try {
            const query = `
                SELECT
                    h.name
                    ,h.barcode
                    ,h.phone_number
                    ,h.departure
                    ,h.arrival
                    ,${selectedColumns}
                FROM hikers h
                LEFT JOIN checkpoints c
                ON h.barcode = c.barcode
                WHERE h.distance = $1
            `;

    
            const result = await db.query(query, [distance]);
            const hikerSatistics = await db.query(
                `SELECT
                    COUNT(*) FILTER (
                        WHERE distance = $1
                        AND arrival IS NOT NULL 
                        AND date(departure) != '9999-12-31' AND date(arrival) != '9999-12-31') AS hikers_arrived
                    ,COUNT(*) FILTER (
                        WHERE distance = $1 
                        AND date(departure) != '9999-12-31' AND (arrival IS NULL OR date(arrival) != '9999-12-31')) AS hikers_total
                FROM
                    hikers
                    `,[distance]
            );
            const hikersArrived = hikerSatistics.rows[0].hikers_arrived;
            const hikersTotal = hikerSatistics.rows[0].hikers_total;
    
            const hikersWithStatus = result.rows.map(hiker => {
                let completionTime = "Még nem indult el";

                //lassúságfigyelő
                let isDelayed = false;
    
                const departureDate = hiker.departure ? new Date(hiker.departure) : null;
                const arrivalDate = hiker.arrival ? new Date(hiker.arrival) : null;
    
                //feladás ellenőrzése
                const getTimePart = (date) => date?.toTimeString().split(" ")[0];
                const isDroppedOut =
                    (departureDate && getTimePart(departureDate) === "00:00:00") ||
                    (arrivalDate && getTimePart(arrivalDate) === "00:00:00");
                
                if(isDroppedOut) {
                    completionTime = "Feladta";

                    //minden állomás oszlopában szerepeljen a 00:00:00
                    selectedStations.forEach(stationKey => {
                        hiker[stationKey] = new Date("9999-12-31 00:00:00");
                    });

                } else if(departureDate && !arrivalDate) {
                    let lastCheckpoint = "Elindult";
                    for(let i = selectedStations.length -1; i >= 0; i--) {
                        const stationKey = selectedStations[i];
                        if(hiker[stationKey]) {
                            lastCheckpoint = stationKey;;
                            break;
                        }
                    }
                    completionTime = lastCheckpoint;

                    if(lastCheckpoint) {
                        //const lastTime = new Date(hiker[lastCheckpoint]);
                        const lastTime = new Date(lastCheckpoint ==="Elindult" ? hiker.departure : hiker[lastCheckpoint]);
                        const now = new Date();
                        const minutesPassed = (now - lastTime) / (1000 * 60);
                        const nextStation = selectedStations[selectedStations.indexOf(lastCheckpoint) + 1] || "start";
                        //const pairKey = `${lastCheckpoint}->${nextStation}`;
                        const normalizedLastCheckpoint = lastCheckpoint === "Elindult" ? "start" : lastCheckpoint;
                        const pairKey = `${normalizedLastCheckpoint}->${nextStation}`;

                        const reference = referenceTimes[distance]?.[pairKey];

                        if(reference && minutesPassed > reference) {
                            isDelayed = true;
                        }
                    }
    
                } else if(departureDate && arrivalDate) {
                    const diffMs = arrivalDate - departureDate;
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                    completionTime = `${hours} óra ${minutes} perc ${seconds} mp`;
                }
    
                return { ...hiker, completionTime, isDelayed };
            });
            return res.json({
                hikers: hikersWithStatus,
                hikersArrived,
                hikersTotal
        });
    
        } catch (err) {
            console.error("Lekérdezési hiba:", err);
            return res.status(500).json({ message: "Szerverhiba történt", status: "error" });
        }
    } else {
        try {
            const station = distance;

            const validDistance = Object.entries(stationColumns)
                .filter(([_, stations])=> stations.includes(station))
                .map(([dist]) => parseInt(dist));

            if(validDistance.length === 0) {
                return res.json([]);
            }

            const safeStation = `"${station}"`;

            const query = `
                SELECT
                    h.name
                    ,h.barcode
                    ,h.phone_number
                    ,h.departure
                    ,h.arrival
                    ,c.${safeStation}
                FROM hikers h
                LEFT JOIN checkpoints c
                ON h.barcode = c.barcode
                WHERE h.distance = ANY($1)
            `;

            const result = await db.query(query, [validDistance]);

            const response = result.rows.map(hiker => {
                //const hasDeparted = hiker.departure && hiker.departure.toISOString().slice(0, 10) !== "9999-12-31";
                const getTimePart = (date) => date?.toTimeString().split(" ")[0];
                const isDroppedOut =
                    (hiker.departure && getTimePart(new Date(hiker.departure)) === "00:00:00") ||
                    (hiker.arrival && getTimePart(new Date(hiker.arrival)) === "00:00:00");
                const checkpointTime = hiker[station];

                let status = "Nem indult el";
                let isDelayed = false;

                if(isDroppedOut) {
                    status="Feladta";
                    isDelayed = false;
                    hiker[station] = new Date("9999-12-31 00:00:00");
                }

                else if(hiker.departure && !checkpointTime) {
                    status = "Várjuk";
                }
                else if(checkpointTime) {
                    //const time = new Date(checkpointTime).toLocaleDateString("hu-HU");
                    const time = new Date(checkpointTime);
                    //const time = new Date(lastCheckpoint ==="Elindult" ? hiker.departure : hiker[lastCheckpoint]);
                    const hours = time.getHours();
                    const minutes = time.getMinutes();
                    const seconds = time.getSeconds();
                    status = `${hours} óra ${minutes} perc ${seconds} mp`;

                    const now = new Date();
                    const minutesPassed = (now - time) / (1000*60);
                    //const reference = referenceTimes?.[validDistance[0]]?.[`${station}->start`];
                    const stationList = stationColumns[validDistance[0]];
                    const currentIndex = stationList.indexOf(station);
                    const previousStation = currentIndex > 0 ? stationList[currentIndex - 1] : "start";
                    const pairKey = `${previousStation}->${station}`;
                    const reference = referenceTimes?.[validDistance[0]]?.[pairKey];

                    if (reference && minutesPassed > reference) {
                        isDelayed = true;
                    }
                }


                return {
                    name: hiker.name,
                    barcode: hiker.barcode,
                    departure: hiker.departure,
                    //arrival: hiker.arrival,
                    [station]: hiker[station],
                    completionTime: status,
                    isDelayed
                };
            });

            const statsQuery = `
                SELECT
                    COUNT(*) FILTER (
                        WHERE h.distance = ANY($1)
                        AND (arrival IS NULL OR date(h.arrival) != '9999-12-31')
                        AND date(h.departure) != '9999-12-31'
                    ) AS hikers_total,
                    COUNT(*) FILTER (
                        WHERE h.distance = ANY($1)
                        AND( c.${station} IS NOT NULL OR h.arrival IS NOT NULL)
                        AND(arrival IS NULL OR date(h.arrival) != '9999-12-31')
                        AND date(h.departure) != '9999-12-31'
                        
                    ) AS hikers_arrived
                FROM hikers h
                LEFT JOIN checkpoints c ON h.barcode = c.barcode    
            `;
            //AND c.${station} IS NOT NULL ennek az üres SQL sorban van a helye

            const statsResult = await db.query(statsQuery, [validDistance]);
            
            const hikersTotal = statsResult.rows[0].hikers_total;
            const hikersArrived = statsResult.rows[0].hikers_arrived;


            return res.json({
                hikers: response,
                hikersTotal,
                hikersArrived
            });


        } catch (err) {
            console.error("Állomás lekérdezési hiba:", err);
            return res.status(500).json({ message: "Szerverhiba történt", status: "error" });
        }
    }
    
});

app.post("/update-checkpoint-data", isUser, async (req, res) => {
    const { barcode, departure, arrival, stations, distance } = req.body;


    try {
        //hikers frissítése
        await db.query(
            `UPDATE hikers
            SET departure = $1, arrival = $2
            WHERE barcode = $3`,
            [departure || null, arrival || null, barcode]
        );

        //itt jön a beszúrás ha kell
        const checkRes = await db.query("SELECT 1 FROM checkpoints WHERE barcode = $1", [barcode]);

        if (checkRes.rows.length === 0) {
            await db.query("INSERT INTO checkpoints (barcode) VALUES ($1)", [barcode]);
            console.log("Új sor beszúrva a checkpoints táblába (modalból).");
        }

        let allowedStations;

        if(!isNaN(distance)) {
            allowedStations = stationColumns[distance];
        } else {
            allowedStations = [distance];
        }

        //const allowedStations = stationColumns[distance];

        if (!allowedStations) {
            return res.status(400).json({ message: "Érvénytelen táv!", status: "error" });
        }

        // csak engedélyezett mezők kerülnek az update-be
        const updateParts = [];
        const updateValues = [];
        let idx = 1;

        for (let station of allowedStations) {
            if (Object.hasOwn(stations, station)) {
                updateParts.push(`${station} = $${idx}`);
                updateValues.push(stations[station] || null);
                idx++;
            } else {
                console.warn(`Állomás kimaradt a kliensoldalról: ${station}`);
            }
        }

        if (updateParts.length > 0) {
            // hozzáadjuk a barcode-ot is a WHERE-hez
            const updateQuery = `
                UPDATE checkpoints
                SET ${updateParts.join(", ")}
                WHERE barcode = $${idx}
            `;
            updateValues.push(barcode);


            const updateRes = await db.query(updateQuery, updateValues);
        }

        res.json({ message: "Adatok sikeresen frissítve!", status: "success" });

    } catch (err) {
        console.error("Frissítési hiba:", err);
        res.status(500).json({ message: "Szerverhiba történt", status: "error" });
    }
});

app.get("/export-csv-checkpoints", isViewer, async (req, res)=> {
    try {
        const result = await db.query("SELECT h.id, h.barcode, h.distance, h.departure, c.piros_haz, c.gyugy, c.gore_kilato, c.kishegy, c.harsas_puszta, h.arrival FROM hikers h LEFT JOIN checkpoints c ON h.barcode = c.barcode ORDER BY h.id ASC");
        const hikers = result.rows;

        if(hikers.length === 0) {
            return res.status(404).json({ message: "Nincsenek adatok az exporthoz!", status: "error" });
        }

        const csvFields = ["id", "barcode", "tav", "indulas", "piroshaz", "gyugy", "gorekilato", "kishegy", "harsaspuszta", "bendekpuszta", "erkezes"];
        const json2csvParser = new Parser({ fields: csvFields });
        const csvData = json2csvParser.parse(hikers);

        const filePath = "exports/hikers_export.csv";
        fs.writeFileSync(filePath, csvData, "utf-8");

        res.download(filePath, "hikers_export.csv", () => {
            fs.unlinkSync(filePath); // Letöltés után töröljük a fájlt
        });
    } catch(err) {
        console.error("Hiba történt az adatok exportálása során", err);
        res.status(500).json({ message: "Hiba történt az exportálás során!", status: "error" });
    }
});







// Szerver futtatása
app.listen(port, () => {
    console.log(`App is running on port ${port}.`);
});
