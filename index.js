// env vars
require("dotenv").config();
const { BOT_TOKEN, MISTRAL_API_KEY } = process.env;

// tg bot modules
const { Bot, MemorySessionStorage, GrammyError, HttpError } = require("grammy");
const { chatMembers } = require("@grammyjs/chat-members");

// ai module
const { Mistral } = require("@mistralai/mistralai");

// db module
const sqlite3 = require("sqlite3");

// store/api settings
const client = new Mistral({ apiKey: MISTRAL_API_KEY });
const adapter = new MemorySessionStorage();

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

const bot = new Bot(BOT_TOKEN);
bot.use(chatMembers(adapter));

const instruction = `
Ты - классификатор спама в чате Winderton. Твоя задача - определить, является ли сообщение спамом или нет, учитывая, что сообщение может содержать шутки, мемы или другой развлекательный контент, который не является спамом, этот чат - чат программистов, основной спам который тут есть это предложения о заработке, пожалуйста классифицируй только по параметру является ли сообщение предложением о заработке/наборе людей куда-то или нет.
СПАМ-сообщение так же может содержать большое количество ссылок например @GOLD_SIGNALS 

Внимательно прочитай сообщение и ответь, используя следующий формат:

{
"is_spam": true/false
}

Где "is_spam" - это логическое значение, указывающее, является ли сообщение спамом.
Нужное сообщение для проверки:
`;

async function checkMessageByAI(message) {
    try {
        const prompt = instruction + "\n" + message;

        const chatResponse = await client.chat.complete({
            model: "mistral-large-latest",
            messages: [
                {
                    role: "user",
                    content:
                        prompt +
                        "Send response in JSON and only JSON format. WITHOUT MARKDOWN FORMATTING. Avoid backticks. Only JSON. If u give me response like that ```json response``` i will kill myself right fucking now",
                },
            ],
            response_format: { type: "json_object" },
        });

        let response = chatResponse?.choices[0]?.message.content;
        if (response.startsWith("```json") && response.endsWith("```")) {
            response = response.slice(7, -3).trim();
        }
        response = JSON.parse(response);
        console.log(response);
        return response.is_spam;
    } catch (error) {
        console.error(error);
    }
}

async function updateStatistics() {
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
updateStatistics();

bot.on("message", async (ctx) => {
    if (
        typeof ctx.message.text == "string" &&
        ctx.message.text === "Секретная фраза для получения статистики у бота"
    ) {
        const stats = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM statistic WHERE id = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const allNotBannedSpammers =
            (await new Promise((resolve, reject) => {
                db.get(
                    "SELECT * FROM spammers WHERE isBanned = false",
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            })) || [];

        const allBannedSpammers =
            (await new Promise((resolve, reject) => {
                db.get(
                    "SELECT * FROM spammers WHERE isBanned = true",
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            })) || [];

        const message = `Всего проверок: ${stats.howMuchChecks}\nВсего спама: ${
            stats.howMuchSpam
        }\nВсего НЕ спама: ${stats.howMuchMiss}\n\nВсего спамеров: ${
            allBannedSpammers.length + allNotBannedSpammers.length
        }\nВсего забанных спамеров: ${
            allBannedSpammers.length
        }\nВсего НЕзабаненных спамеров ${allNotBannedSpammers.length}`;

        await ctx.reply(message);
        return;
    }

    // 6698478458 - banned id
    // {
    //     user: {
    //       id: 6698478458,
    //       is_bot: false,
    //       first_name: 'Феликс Шиховцов',
    //       username: 'Feliks_PRmen',
    //       is_premium: true
    //     },
    //     status: 'kicked',
    //     until_date: 0
    //   }

    let isSpam = false;
    if (typeof ctx.message.text == "string" && ctx.message.text.length > 50) {
        const stats = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM statistic WHERE id = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        await new Promise((resolve, reject) => {
            db.run(
                "UDDATE statistic SET howMuchChecks = ? WHERE id = 1",
                [stats.howMuchChecks + 1],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        isSpam = (await checkMessageByAI(ctx.message.text)) || false;
    }
    if (isSpam) {
        await new Promise((resolve, reject) => {
            db.run(
                "UDDATE statistic SET howMuchSpam = ? WHERE id = 1",
                [stats.howMuchSpam + 1],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        const memberData = await new Promise((resolve, reject) => {
            db.get(
                "SELECT * FROM spammers WHERE id = ?",
                [ctx.from.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        if (!memberData) {
            await new Promise((resolve, reject) => {
                db.run(
                    "INSERT INTO spammers (id, isBanned) VALUES (?, ?)",
                    [ctx.from.id, false],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        await ctx.reply("spam", {
            reply_parameters: { message_id: ctx.msg.message_id },
        });
    } else {
        await new Promise((resolve, reject) => {
            db.run(
                "UDDATE statistic SET howMuchMiss = ? WHERE id = 1",
                [stats.howMuchMiss + 1],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    const allSpammers =
        (await new Promise((resolve, reject) => {
            db.get(
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
                    "UDDATE spammers SET isBanned = true WHERE id = ?",
                    [spammer.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
    });

    console.log(`${isSpam}: ${ctx.from.id}:\n${ctx.message.text}`);
});

bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}`);

    const e = err.error;
    if (e instanceof GrammyError) {
        console.error(`Error in request: ${e.description}`);
    } else if (e instanceof HttpError) {
        console.error(`Could not connect to Telegram: ${e}`);
    } else {
        console.error(`Unknown error: ${e}`);
    }
});

bot.start({
    allowed_updates: ["chat_member", "message"],
});
