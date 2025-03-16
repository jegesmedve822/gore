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

