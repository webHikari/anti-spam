const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("./stats.db");

db.serialize(() => {
    db.run(
        `CREATE TABLE IF NOT EXISTS statistic (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            howMuchChecks INTEGER NOT NULL,
            howMuchSpam INTEGER NOT NULL,
            howMuchMiss INTEGER NOT NULL
        )`,
        (err) => {
            if (err) {
                console.error("Error creating stats table: " + err);
                return;
            } else {
                console.log("Stats table created successfully");
            }
        }
    );

    db.run(
        `CREATE TABLE IF NOT EXISTS spammers (
        id INTEGER NOT NULL,
        isBanned BOOLEAN NOT NULL
    )`,
        (err) => {
            if (err) {
                console.error("Error creating spammers table: " + err);
                return;
            } else {
                console.log("Spammers table created successfully");
            }
        }
    );

    db.run(
    `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER NOT NULL,
        message_id INTEGER NOT NULL,
        isSpam BOOLEAN DEFAULT 0
    )`,
        (err) => {
            if (err) {
                console.error("Error creating messages table: " + err);
                return;
            } else {
                console.log("Messages table created successfully");
            }
        }
    );

    db.run(
        `CREATE TABLE IF NOT EXISTS falses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL
        )`,
        (err) => {
            if (err) {
                console.error("Error creating falses table: " + err);
                return;
            } else {
                console.log("Falses table created successfully");
            }
        }
    );

    db.run(
        `CREATE TABLE IF NOT EXISTS spamMessages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL
        )`,
        (err) => {
            if (err) {
                console.error("Error creating spamMessages table: " + err);
                return;
            } else {
                console.log("spamMessages table created successfully");
            }
        }
    );
});
