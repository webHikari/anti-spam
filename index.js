require("dotenv").config();
const { Bot } = require("grammy");
const { Mistral } = require("@mistralai/mistralai");

const { BOT_TOKEN, MISTRAL_API_KEY } = process.env;

const client = new Mistral({ apiKey: MISTRAL_API_KEY });

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
        console.error(error)
    }
}

const bot = new Bot(BOT_TOKEN);

bot.on("message", async (ctx) => {
    let isSpam = false;
    if (typeof ctx.message.text == "string" && ctx.message.text.length > 50) {
        isSpam = await checkMessageByAI(ctx.message.text) || false;
    }
    if (isSpam) {
        await ctx.reply("spam", {
            reply_parameters: { message_id: ctx.msg.message_id },
        });
    }
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

bot.start();
