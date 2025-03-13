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
            return res.send("A vonalkód már létezik az adatbázisban, adj meg másikat!");
        } else {
            const result = await db.query("INSERT INTO hikers (name, distance, barcode) VALUES($1, $2, $3) RETURNING *",
                [name, distance, barcode]
            );
            res.send("A rekordok beillesztése kerültek az adatbázisba!");
        }
    } catch(err) {
        console.log(err);
        res.status(500).send("Hiba történt az adatbázis művelet során!");
    }
});



// Szerver futtatása
app.listen(port, () => {
    console.log(`App is running on port ${port}.`);
});
