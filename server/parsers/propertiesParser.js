const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs'); // Import fs module for file operations

const url = 'https://www.chipdip.by/catalog/electronic-components';
const baseUrl = 'https://www.chipdip.by';
const indexesToRemove = [2, 5, 6, 7, 8, 9, 17, 20, 21];

let num = 0; // Global counter for tracking progress
let buff = 250;

//147 537 829 830 914 1072 1082 1224 1225 1527 1528 1620 1689 1776 1879 2055 2112 2553 2919 3090 3215 3318 3319 3341 3342 3547 3548 3568 3641 из 3650

// Function for delay
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to get links to component types with retry mechanism
async function getComponentTypeLinks() {
  let maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      let typeLinks = [];
      let types = Array.from($('.catalog__g1.clear')).filter((_, index) => !indexesToRemove.includes(index));

      types.forEach((typeElement) => {
        $(typeElement).find('li.catalog__item a.link').each((_, link) => {
          typeLinks.push(`${baseUrl}${$(link).attr('href')}`);
        });
      });

      console.log(`Получены ссылки на подтипы компонентов: ${typeLinks.length}`);
      return typeLinks;

    } catch (error) {
      attempts++;
      console.error(`Ошибка при получении ссылок на подтипы компонентов (попытка ${attempts}):`, error.message);

      if (attempts < maxRetries) {
        console.log('Повторная попытка...');
        await delay(1500); // Delay before retrying
      } else {
        throw new Error('Не удалось получить ссылки на подтипы компонентов после нескольких попыток');
      }
    }
  }
}

// Function to get component links with retry mechanism
async function getComponentLinks(typeLinks) {
  try {
    let componentLinks = [];
    let type_check = 0;

    for (let typeLink of typeLinks) {
      let maxRetries = 3;
      let attempts = 0;
      let success = false;
      let component_check = 0;

      while (attempts < maxRetries && !success) {
        try {
          const { data } = await axios.get(typeLink);
          const $ = cheerio.load(data);

          let links = $('.item a.link');
          if (links.length === 0) {
            links = $('.with-hover a.link');
          }

          let count = 0;
          links.each((_, link) => {
            if (count < 20) {
              componentLinks.push(`${baseUrl}${$(link).attr('href')}`);
              count++;
            } else {
              return false;
            }
          });

          success = true;
          component_check = count;

        } catch (error) {
          attempts++;
          console.error(`Ошибка при получении ссылок на компоненты для ${typeLink} (попытка ${attempts}):`, error.message);

          if (attempts < maxRetries) {
            console.log('Повторная попытка...');
            await delay(1500);
          } else {
            console.warn(`Не удалось получить ссылки для ${typeLink} после ${maxRetries} попыток.`);
          }
        }
      }
      console.log(`Получено ${component_check} компонентов подтипа ${typeLinks[type_check]}`);
      type_check++;
    }

    console.log(`Получены ссылки на компоненты: ${componentLinks.length}`);
    
    // Save componentLinks to a file, each link on a new line
    fs.writeFileSync('components.txt', componentLinks.join('\n'), 'utf-8');
    console.log('Ссылки на компоненты успешно записаны в файл components.txt');
    
  } catch (error) {
    console.error('Ошибка при получении ссылок на компоненты:', error.message);
    throw error;
  }
}

// Функция для получения свойств компонента с повторными попытками
async function scrapeAllProperties(componentLinks, properties) {
  try {
    for (let i = num; i < componentLinks.length; i++) {
      const componentLink = componentLinks[i];
      let maxRetries = 3;
      let attempts = 0;
      let success = false;

      if (num === buff) {
        break;
      }

      while (attempts < maxRetries && !success) {
        try {
          const { data } = await axios.get(componentLink);
          const $ = cheerio.load(data);

          // Проверка на наличие <h3>Технические параметры</h3> с 5 повторными попытками
          let headerFound = false;
          for (let j = 0; j < 5; j++) {
            const header = $('h3').filter((_, el) => $(el).text().trim() === 'Технические параметры');
            if (header.length > 0) {
              headerFound = true;
              break;
            } else {
              console.warn(`Элемент <h3>Технические параметры</h3> не найден для ${componentLink}. Повторная проверка ${j + 1}...`);
              
              // Если заголовок так и не найден, пропустить текущий компонент и перейти к следующему
              if (j == 4) {
                console.warn(`Элемент <h3>Технические параметры</h3> не найден после 5 попыток для ${componentLink}. Пропускаем итерацию...`);
                num++;
                continue;
              } else {
                await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500);
              }
            }
          }

          const paramNames = $('.product__param-name');
          const paramValues = $('.product__param-value');

          if (paramNames.length > 0 && paramValues.length > 0) {
            paramNames.each((index, param) => {
              const paramName = $(param).text().trim();
              const paramValue = paramValues.eq(index).text().trim();

              properties.push({
                name: paramName,
                value: paramValue,
                num: parseInt(i+1)
              });
            });

            console.log(`${i + 1} из ${componentLinks.length}; ${paramNames.length} названий и ${paramValues.length} значений`);
            success = true;
          } else {
            console.warn(`Попытка ${attempts + 1} не удалась: свойства не найдены для ${componentLink}`);
            attempts++;
            if (attempts < maxRetries) {
              console.log('Повторная попытка...');
              await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500);
            }
          }
        } catch (error) {
          attempts++;
          console.error(`Ошибка при попытке ${attempts + 1} загрузить страницу компонента ${componentLink}: ${error.message}`);

          if (attempts < maxRetries) {
            await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500);
          }
        }
      }

      if (!success) {
        console.warn(`Не удалось получить свойства для ${componentLink} после ${maxRetries} попыток.`);
      }

      num++;
      await delay(Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500);
    }

    console.log('Свойства компонентов получены');
    return properties;
  } catch (error) {
    console.error('Ошибка при парсинге свойств компонентов:', error.message);
    throw error;
  }
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

// Основная функция для выполнения всех шагов
async function scrapeProperties() {
  try {
    // const typeLinks = await getComponentTypeLinks();
    // await getComponentLinks(typeLinks);

    const componentLinks = await loadComponentLinksFromFile();
    let properties = [];

    while (num < buff/*componentLinks.length*/) {
      console.log(`Текущий статус: спарсено ${num} из ${componentLinks.length}`);
      await delay(Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000);
      properties = await scrapeAllProperties(componentLinks, properties);
    }

    console.log('Собранные свойства компонентов:', properties);
    return properties;

  } catch (error) {
    console.error('Ошибка при выполнении скрапинга свойств компонентов:', error.message);
  }
}

module.exports = { scrapeProperties };