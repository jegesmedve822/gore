//modul, amivel konfiguráljuk a távolságokat
export const stationColumns = {
    12: ["piros_haz", "gyugy", "gore_kilato"],
    24: ["kishegy", "piros_haz", "gyugy", "gore_kilato"],
    34: ["kishegy", "piros_haz", "harsas_puszta", "bendek_puszta", "gyugy", "gore_kilato"]
};

export const referenceTimes = {
    12: {
        "start->piros_haz": 2,
        "piros_haz->gyugy": 2,
        "gyugy->gore_kilato": 2,
        "gore_kilato->start": 2
    },
    24: {
        "start->kishegy": 2,
        "kishegy->piros_haz": 2,
        "piros_haz->gyugy": 2,
        "gyugy->gore_kilato": 2,
        "gore_kilato->start": 2
    },
    34: {
        "start->kishegy": 2,
        "kishegy->piros_haz": 2,
        "piros_haz->harsas_puszta": 2,
        "harsas_puszta->bendek_puszta":2,
        "bendek_puszta->gyugy":2,
        "gyugy->gore_kilato": 2,
        "gore_kilato->start": 2
    }
};

export const levelTime = {
    12: 5,
    24: 7,
    34: 9
};

/*module.exports = {
    stationColumns,
    referenceTimes,
    //levelTime
};*/



