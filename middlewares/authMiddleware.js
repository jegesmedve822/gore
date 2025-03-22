export function isAuthenticated(req, res, next) {
    if(req.isAuthenticated()) {
        return next();
    } else {
        return res.redirect("/");
    }
}

export function isSysAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.redirect("/");
    }
    if (req.user.role === "sysadmin") {
        return next();
    } else {
        return res.status(403).render("error.ejs", { message: "Ehhez a funkcióhoz nincs jogosultságod!" });
    }
}

export function isUser(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.redirect("/");
    }
    if (req.user.role === "user" || req.user.role === "sysadmin") {
        return next();
    } else {
        return res.status(403).render("error.ejs", { message: "Ehhez a funkcióhoz nincs jogosultságod!" });
    }
}

export function isViewer(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.redirect("/");
    }
    if (req.user.role === "viewer" || req.user.role === "user" || req.user.role === "sysadmin") {
        return next();
    } else {
        return res.status(403).render("error.ejs", { message: "Ehhez a funkcióhoz nincs jogosultságod!" });
    }
}

//starter jogosultság
export function isStarter(req, res, next) {
    if(!req.isAuthenticated()) {
        return res.redirect("/");
    } if (req.user.role === "starter" || req.user.role === "user" || req.user.role === "sysadmin") {
        return next();
    } else {
        return res.status(403).render("error.ejs", { message: "Ehhez a funkcióhoz nincs jogosultságod!" });
    }
}

//checkpoint jpgosultság
export function isCheckpoint(req, res, next) {
    if(!req.isAuthenticated()) {
        return res.redirect("/");
    }
    if(req.user.role && req.user.role.startsWith("c-")) {
        return next();
    } else {
        return res.status(403).render("error.ejs", { message: "Ehhez a funkcióhoz nincs jogosultságod!" });
    }
}

export function isCoreUser(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.redirect("/");
    }

    const role = req.user.role.toLowerCase();

    if (role.startsWith("c-")) {
        // Checkpoint user, ide nem jöhet
        return res.status(403).render("error.ejs", {
            message: "Ehhez a felülethez nincs jogosultságod!"
        });
    }
    return next();
}

