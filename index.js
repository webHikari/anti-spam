require("dotenv").config();
const { Bot } = require("grammy");
const { Mistral } = require("@mistralai/mistralai");

const { BOT_TOKEN, MISTRAL_API_KEY } = process.env;

const client = new Mistral({ apiKey: MISTRAL_API_KEY });

const instruction = `
Ты - классификатор спама в чате Winderton. Твоя задача - определить, является ли сообщение спамом или нет, учитывая, что сообщение может содержать шутки, мемы или другой развлекательный контент, который не является спамом.

Внимательно прочитай сообщение и ответь, используя следующий формат:

{
"is_spam": true/false
}

Где "is_spam" - это логическое значение, указывающее, является ли сообщение спамом.
Нужное сообщение для проверки:
`;

async function checkMessageByAI(message) {
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
}

const bot = new Bot(BOT_TOKEN);

bot.on("message", async (ctx) => {
    let isSpam = false;
    if (typeof ctx.message.text == "string" && ctx.message.text.length > 80) {
        isSpam = await checkMessageByAI(ctx.message.text);
    }
    if (isSpam) {
        await ctx.reply("spam", {
            reply_parameters: { message_id: ctx.msg.message_id },
        });
    }
    console.log(`${isSpam}: ${ctx.from.id}:\n${ctx.message.text}`);
});

bot.start();
