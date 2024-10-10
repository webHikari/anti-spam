const sqlite3 = require("sqlite3");

const db = new sqlite3.Database(
    "./database/stats.db",
    sqlite3.OPEN_READWRITE,
    (err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log("Connected to the SQLite database.");
        }
    }
);

class StatisticsService {
    async initDB() {
        const stats = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM statistic WHERE id = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!stats) {
            await new Promise((resolve, reject) => {
                db.run(
                    "INSERT INTO statistic (howMuchChecks, howMuchSpam, howMuchMiss) VALUES (?, ?, ?)",
                    [0, 0, 0],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
    }



    async getStats() {
        const stats = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM statistic WHERE id = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const allNotBannedSpammers =
            (await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM spammers WHERE isBanned = false",
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            })) || [];

        const allBannedSpammers =
            (await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM spammers WHERE isBanned = true",
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            })) || [];
        const response = {
            stats,
            allNotBannedSpammers,
            allBannedSpammers,
        };
        return response;
    }

    async incChecks() {
        const { stats } = await this.getStats();

        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE statistic SET howMuchChecks = ? WHERE id = 1",
                [stats.howMuchChecks + 1],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async incSpam() {
        const { stats } = await this.getStats();

        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE statistic SET howMuchSpam = ? WHERE id = 1",
                [stats.howMuchSpam + 1],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async incMisses() {
        const { stats } = await this.getStats();

        await new Promise((resolve, reject) => {
            db.run(
                "UPDATE statistic SET howMuchMiss = ? WHERE id = 1",
                [stats.howMuchMiss + 1],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async markUserAsSpammer(id) {
        const memberData = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM spammers WHERE id = ?", [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        if (!memberData) {
            await new Promise((resolve, reject) => {
                db.run(
                    "INSERT INTO spammers (id, isBanned) VALUES (?, ?)",
                    [id, false],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
    }

    async updateSpammersStatus(ctx) {
        const allSpammers =
            (await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM spammers WHERE isBanned = false",
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            })) || [];

        allSpammers.forEach(async (spammer) => {
            const chatMember = await ctx.chatMembers.getChatMember(
                ctx.chat.id,
                spammer.id
            );

            if (chatMember.status === "kicked") {
                await new Promise((resolve, reject) => {
                    db.run(
                        "UPDATE spammers SET isBanned = true WHERE id = ?",
                        [spammer.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        });
    }

    async insertMessage(user_id, message_id) {
        await new Promise((resolve, reject) => {
            db.run(
                "INSERT INTO messages (id, message_id) VALUES (?, ?)",
                [user_id, message_id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });        
    }

    async getUserMessages(user_id) {
        const messages = await new Promise((resolve, reject) => {
            db.all(
                "SELECT * FROM messages WHERE id = ?",
                [user_id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        return messages
    }
}

module.exports = new StatisticsService();

