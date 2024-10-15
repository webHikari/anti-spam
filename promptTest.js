require("dotenv").config()
const { Mistral } = require("@mistralai/mistralai");
const { MISTRAL_API_KEY } = process.env

const client = new Mistral({ apiKey: MISTRAL_API_KEY });
const { instruction } = require("./instruction")


const StatisticsService = require("./service/statistics.service");
StatisticsService.initDB();


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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    let handledCount = 0;
    let total = 0;

    const falses = await StatisticsService.getFalses();

    // Обрабатываем не спам последовательно
    for (const message of falses) {
        total++
        await sleep(1500); // Задержка между запросами
        const response = await checkMessageByAI(message.message);
        if (response.confidence > 70 && response.is_spam === true) {
            handledCount++;
        }
        const successRate = (handledCount / falses.length) * 100;
        console.log("То, что было не спамом, теперь спам в " + successRate.toFixed(2) + "% случаев. " + total + "/" + falses.length + " Спама: " + handledCount);
    }
    const successRate = (handledCount / falses.length) * 100;
    console.log("То, что было не спамом, теперь спам в " + successRate.toFixed(2) + "% случаев");
    
    // Вычисляем процент успеха для "не спама"

    // Обнуляем счетчик для второй части
    handledCount = 0;
    total = 0

    const spam = await StatisticsService.getSpam();
    // Обрабатываем спам последовательно
    for (const message of spam) {
        total++
        await sleep(1500); // Задержка между запросами
        const response = await checkMessageByAI(message.message);
        if (response.confidence > 70 && response.is_spam === true) {
            handledCount++; 
        }
        const successRateSpam = (handledCount / spam.length) * 100;
        console.log("То, что было спамом, теперь спам в " + successRateSpam.toFixed(2) + "% случаев. " + total + "/" + spam.length + " Спама: " + handledCount);
    }
    
    // Вычисляем процент успеха для "спама"
    const successRateSpam = (handledCount / spam.length) * 100;
    console.log("То, что было спамом, теперь спам в " + successRateSpam.toFixed(2) + "% случаев" + " Спама: " + handledCount);

}


main()