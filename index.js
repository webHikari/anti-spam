// env vars
require("dotenv").config();
const { BOT_TOKEN, MISTRAL_API_KEY, CHAT_ID, LOGS_CHAT_ID } = process.env;

// tg bot modules
const {
    Bot,
    MemorySessionStorage,
    GrammyError,
    HttpError,
    InlineKeyboard,
    session,
} = require("grammy");
const { chatMembers } = require("@grammyjs/chat-members");
const { hydrate } = require("@grammyjs/hydrate");

// ai module
const { Mistral } = require("@mistralai/mistralai");

// db module

// store/api settings
const client = new Mistral({ apiKey: MISTRAL_API_KEY });
const adapter = new MemorySessionStorage();

const StatisticsService = require("./service/statistics.service");
StatisticsService.initDB();

const bot = new Bot(BOT_TOKEN);
bot.use(hydrate());

bot.use(
    session({
        initial() {
            // return empty object for now
            return {};
        },
    })
);

bot.use(chatMembers(adapter));

const { instruction } = require("./instruction");

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
        return response;
    } catch (error) {
        console.error(error);
    }
}

bot.on("message", async (ctx) => {
    if (
        typeof ctx.message.text == "string" &&
        ctx.message.text === "Секретная фраза для получения статистики у бота"
    ) {
        const { stats, allNotBannedSpammers, allBannedSpammers } =
            await StatisticsService.getStats();
        const totalSpammers =
            allBannedSpammers.length + allNotBannedSpammers.length;
        let message = "```\n";
        message += "| Статистика                     | Значение \n";
        message += "|--------------------------------|----------\n";
        message += `| Всего проверок                 | ${stats.howMuchChecks
            .toString()
            .padStart(4)} \n`;
        message += `| Всего спама                    | ${stats.howMuchSpam
            .toString()
            .padStart(4)} \n`;
        message += `| Всего НЕ спама                 | ${stats.howMuchMiss
            .toString()
            .padStart(4)} \n`;
        message += `| Всего спамеров                 | ${totalSpammers
            .toString()
            .padStart(4)} \n`;
        message += `| Всего забаненных спамеров      | ${allBannedSpammers.length
            .toString()
            .padStart(4)} \n`;
        message += `| Всего НЕзабаненных спамеров    | ${allNotBannedSpammers.length
            .toString()
            .padStart(4)} \n`;
        message += "```";

        await ctx.reply(message, { parse_mode: "Markdown" });
        return;
    }

    await StatisticsService.insertMessage(
        ctx.from.id,
        ctx.message.message_id,
        false
    );
    var messages = await StatisticsService.getUserMessages(ctx.from.id);

    if (
        typeof ctx.message.text == "string" &&
        ctx.message.text.length > 50 &&
        messages.length < 500
        // && ctx.chat.id == CHAT_ID
    ) {
        await StatisticsService.incChecks();

        const aiResponse = (await checkMessageByAI(ctx.message.text)) || false;

        if (!(aiResponse?.confidence >= 75 && aiResponse?.is_spam)) {
            // await bot.api.sendMessage(LOGS_CHAT_ID, message, {parse_mode: "HTML", reply_markup: keyboard})
            await StatisticsService.incMisses();
            return;
        }

        await StatisticsService.updateSpamMsg(ctx.from.id, true);
        await StatisticsService.markUserAsSpammer(ctx.from.id);
        await StatisticsService.incSpam();

        const neededMessages = [];
        let totalSpam = 1;
        for (let i = 1; i <= 5; i++) {
            console.log(messages.length - i);

            neededMessages.push(messages[messages.length - i]);
            if (messages[messages.length - i].isSpam === 1) {
                totalSpam++;
            }
        }
        console.log(neededMessages);
        console.log(aiResponse);
        if (totalSpam >= 3) {
            await ctx.reply("бро спамил, ликвидирован");
            await ctx.api.deleteMessage(
                ctx.message.chat.id,
                ctx.message.message_id
            );
            await ctx.api.banChatMember(ctx.message.chat.id, ctx.from.id, {
                until_date: 0,
                revoke_messages: true,
            });
        } else {
            await ctx.api.deleteMessage(
                ctx.message.chat.id,
                ctx.message.message_id
            );
        }
        console.log(totalSpam);

        console.log(
            `${aiResponse?.confidence}: ${ctx.from.id}:\n${ctx.message.text}`
        );
    }
});

// bot.on("callback_query:data", async (ctx) => {

//     const chat_member = await bot.api.getChatMember(CHAT_ID, ctx.from.id)
//     if (chat_member.status !== 'administrator') return await ctx.answerCallbackQuery("пошел нахуй");

//     const btnData = ctx.callbackQuery.data.split("_")

//     // ahaha start
//     const spamLogMsg = ctx.callbackQuery.message.text.split(">>")
//     const username = spamLogMsg[1].slice(7, -2);
//     const text = spamLogMsg[2].slice(10, -1)
//     let message = `<blockquote expandable>>> user: <a href="tg://user?id=${btnData[1]}">${username}</a> \n>> message: <span class="tg-spoiler">${text}</span></blockquote> <blockquote expandable>>> ${spamLogMsg[3]}>>${spamLogMsg[4]}</blockquote>`;
//     // ahaha end

//     if (btnData[0] === 'forgive') {
//         await StatisticsService.insertFalse(text)
//         message += "Прощен"
//     } else if (btnData[0] === 'ban') {
//         await ctx.api.banChatMember(CHAT_ID, btnData[1], {until_date: 0, revoke_messages: true})
//         const messages = await StatisticsService.getUserMessages(btnData[1])
//         messages.forEach(async (message) => {
//             await ctx.api.deleteMessage(CHAT_ID, message.message_id)
//         })
//         message += "Забанен"
//     }
//     await ctx.callbackQuery.message.editText(message, {
//         reply_markup: null,
//         parse_mode: "HTML"
//     })
//     await ctx.answerCallbackQuery();
//   });

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

bot.on("callback_query", async (ctx) => {
    await ctx.answerCallbackQuery();
});

bot.start({
    allowed_updates: ["chat_member", "message", "callback_query"],
});
