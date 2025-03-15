import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import ejs from "ejs";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import dotenv from "dotenv";




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

//Admin oldal megjelenítése
app.get("/admin", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("admin.ejs");
    } else {
        res.redirect("/");
    }
});

//Regisztrációs oldal megjelenítése
app.get("/regisztracio", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("register.ejs");
    } else {
        res.redirect("/");
    }
});

//Indító oldal megjelenítése
app.get("/inditas", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("start.ejs");
    } else {
        res.redirect("/");
    }
});

//Lekérdezős, módosítós oldal megjelenítése
app.get("/modositas", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("query.ejs");
    } else {
        res.redirect("/");
    }
});

//Bejelentkezés az oldalra
app.post("/login", passport.authenticate("local", {
    successRedirect: "/main",
    failureRedirect: "/"
}));

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

let lastInsertedId = null;

//túrázó beszúrása az adatbázisba a userformról
app.post("/registerhiker", async (req, res)=> {
    const name = req.body.name;
    const distance = req.body.distance;
    const barcode = req.body.barcode;

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
app.post("/undo", async (req, res) => {
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
app.post("/recordtimestamp", async (req, res) => {
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


// Szerver futtatása
app.listen(port, () => {
    console.log(`App is running on port ${port}.`);
});
