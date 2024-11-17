const { strictEqual } = require('assert');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs'); // Import fs module for file operations
const clc = require('cli-color');

const url = 'https://www.chipdip.by/catalog/electronic-components';
const baseUrl = 'https://www.chipdip.by';
const indexesToRemove = [2, 5, 6, 7, 8, 9, 17, 20, 21];

let num = 3300;
let buff = 3650;

//147 537 829 830 914 1072 1082 1224 1225 1527 1528 1620 1689 1776 1879 2055 2112 2553 2919 3090 3215 3318 3319 3341 3342 3547 3548 3568 3641 из 3650 - без свойств

//1230 (но он 1300) - не найдено 1395     2223 2224 2244 2245

// Function for delay
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findLineNumber(targetWord) {
  const fileContent = fs.readFileSync("typeComponents.txt", 'utf-8');
  const lines = fileContent.split('\n').filter(link => link.trim());

  for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === targetWord.trim()) {
          return i + 1;
      }
  }
  return null;
}

// Функция для загрузки ссылок из файла в массив
function loadComponentLinksFromFile() {
  try {
    const data = fs.readFileSync('components.txt', 'utf-8'); // Читаем файл как строку
    const componentLinks = data.split('\n').filter(link => link); // Разделяем по строкам и убираем пустые строки
    console.log(`Загружено ${componentLinks.length} ссылок из файла components.txt`);
    return componentLinks;
  } catch (error) {
    console.error('Ошибка при загрузке ссылок из файла:', error.message);
    return [];
  }
}

// Функция для получения свойств компонента с повторными попытками
async function getComponentLinks() {
  let componentLinks = loadComponentLinksFromFile();
  let components = [];

  try {
      for (let i = num; i < buff; i++) {
          const componentLink = componentLinks[i];
          let attempt = 0;
          let success = false;

          // Попытки повторного выполнения запроса при ошибках
          while (attempt < 4 && !success) {
              try {
                  const { data } = await axios.get(componentLink);
                  const $ = cheerio.load(data);

                  // Парсинг данных
                  const titleParam = $('h1').text().trim();
                  const componentPhotoParam = $('img.product__image-preview.item__image_medium').attr("src");
                  const descriptionParam = $('.showhide.item_desc').children().length > 1 
                      ? $('.showhide.item_desc').contents().eq(0).text().trim() 
                      : $('.showhide.item_desc').text().trim();
                  const documentationNameParam = $('a.link.download__link.with-pdfpreview').eq(0).attr("href");
                  const subtypeIdParam = findLineNumber(baseUrl + $('.no-visited.bc__item_link.link.link_dark').eq(3).attr("href"));

                  // Добавляем данные в массив
                  components.push({
                      title: titleParam,
                      componentPhoto: componentPhotoParam,
                      description: descriptionParam,
                      documentationName: documentationNameParam,
                      subtypeId: subtypeIdParam
                  });

                  console.log(`Спаршено ${i + 1} из 3650: ${componentLink}\n\nИмя: ${titleParam}\nФото: ${componentPhotoParam}\nОписание: ${descriptionParam}\nДокументация: ${documentationNameParam}\nПодтип: ${subtypeIdParam}\n`);
                  if (!titleParam) console.log(clc.red("Title не получен"));
                  if (!componentPhotoParam) console.log(clc.red("Component Photo не получен"));
                  if (!descriptionParam) console.log(clc.red("Description не получен"));
                  if (!documentationNameParam) console.log(clc.red("Documentation Name не получен"));
                  if (!subtypeIdParam) console.log(clc.red("Subtype ID не получен"));
                  console.log("------------------------------");

                  success = true; // Устанавливаем успех при удачном выполнении запроса
                  await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500);

              } catch (error) {
                  attempt++;
                  console.error(`Ошибка при обработке компонента по ссылке ${componentLink}.`, error.message);

                  // Обработка ошибок по статус-коду
                  if (error.response && error.response.status === 429) {
                      console.log("Слишком много запросов. Ожидание перед повторной попыткой...");
                      await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500); // Увеличиваем задержку перед следующей попыткой
                  } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
                      console.log("Ошибка соединения. Повторная попытка...");
                      await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500);
                  } else {
                      // Если ошибка не относится к ограничению по запросам или соединению, пробуем еще раз
                      console.log("Непредвиденная ошибка. Повторная попытка...");
                      await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500);
                  }

                  if (attempt === 4) {
                    console.error(`Максимальное число попыток достигнуто для ссылки: ${componentLink}. Пропуск...`);
                    components.push({
                      title: "-",
                      componentPhoto: "-",
                      description: "-",
                      documentationName: "-",
                      subtypeId: 0
                  });
                  }
              }
          }
      }
      
      return components;
  } catch (error) {
      console.error('Ошибка при парсинге видов компонентов:', error.message);
      throw error;
  }
}

// Основная функция для выполнения всех шагов
async function scrapeComponents() {
  try {

    return await getComponentLinks();

  } catch (error) {
    console.error('Ошибка при выполнении скрапинга свойств компонентов:', error.message);
  }
}

module.exports = { scrapeComponents };