// env vars
require("dotenv").config();
const { BOT_TOKEN, MISTRAL_API_KEY, CHAT_ID } = process.env;

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

const StatisticsService = require("./service/statistics.service");
StatisticsService.initDB();

const bot = new Bot(BOT_TOKEN);
bot.use(chatMembers(adapter));

const instruction = `
Ты - классификатор спама в чате Winderton. Твоя задача - определить, является ли сообщение спамом или нет. Учти, что сообщения могут содержать шутки, мемы или развлекательный контент, который не является спамом. Основной спам здесь - это предложения о заработке или набор людей в различные проекты. Важно различать рофлы и юмористические сообщения, которые могут выглядеть как спам, но на самом деле таковыми не являются.

Сообщение считается спамом, если оно:
- содержит конкретные предложения о заработке, наборе людей или рекрутировании;
- содержит явные ссылки на сторонние сервисы, рекламу или мошенничество (например, @GOLD_SIGNALS);
- выражает серьезные намерения по набору людей или заработку, без элементов явного юмора или сарказма.

Сообщение не считается спамом, если оно:
- является шуткой, мемом, или имеет юмористический, саркастический, или абсурдный характер, даже если оно упоминает заработок или работу;
- обсуждает вопросы, связанные с программированием, обучением или обсуждением профессиональных тем;
- включает фразы с юмором или преувеличениями, которые не подразумевают реальных предложений.

Примеры рофлов, которые НЕ являются спамом:
1. "Ну хуе мое вы ничего не знаете, но мы вас может быть научим и через пару месяцев будете зарабатывать 20к, а через год возможно и 40."
2. "Но это уже куда интереснее чем когда к нам приезжали челы с военки и рассказывали про бесплатную работу за опыт."
3. ">learn english
>get a visa
>go to california
>job interview
>say you’re in the usa and are allowed to work
>remotely
>earn bucks from the other side of the world
>profit
(this is NOT a legal advice.)"

Внимательно прочитай сообщение и ответь, используя следующий формат:
Так же выдавай уверенность в спаме в процентах 0-100%

{
  "is_spam": true/false,
  "confidency": 0-100
}

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
        return response;
    } catch (error) {
        console.error(error);
    }
}

console.log(StatisticsService.getStats);

bot.on("message", async (ctx) => {
    // console.log(ctx.message.chat)
    // const { id } = ctx.message.from;
    // const user = await ctx.getChat();


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

    if (typeof ctx.message.text == "string" && ctx.message.text.length > 50) {
        await StatisticsService.incChecks();

        const aiResponse = (await checkMessageByAI(ctx.message.text)) || false;
        console.log(aiResponse);

        if (aiResponse?.confidency > 75) {
            await StatisticsService.markUserAsSpammer(ctx.from.id);

            let message = `spamrate ${aiResponse.confidency}%`

            await ctx.reply(message, {
                reply_parameters: { message_id: ctx.msg.message_id },
            });
        } else {
            await StatisticsService.incMisses();
        }

        console.log(`${aiResponse}: ${ctx.from.id}:\n${ctx.message.text}`);
    }
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
