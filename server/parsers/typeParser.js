const axios = require('axios');
const cheerio = require('cheerio');

const mainUrl = 'https://www.chipdip.by/catalog/electronic-components';

const indexesToRemove = [2, 5, 6, 7, 8, 9, 17, 20, 21]; // Индексы исключаемых элементов

// Функция для парсинга видов компонентов с сайта
async function scrapeTypes() {
  try {
    // Загружаем основную страницу
    const { data } = await axios.get(mainUrl);
    const $ = cheerio.load(data);

    let types = [];
    let items = Array.from($('.catalog__g1.clear')).filter((_, index) => !indexesToRemove.includes(index));

     for (let item of items) {
      
      // Название и ссылка на страницу вида
      const typeName = $(item).find('a.link.link_dark.like-header.like-header_3').text().trim();
      const typeLink = $(item).find('a.link.link_dark.like-header.like-header_3').attr('href');
      const typeImage = $(item).find('img.g_image').attr('src');
      
      // Переход на страницу вида для получения описания
      const description = await fetchDescription(typeLink);

      types.push({
        typeName,
        typeImage,
        description
      });
    }

    return types;
  } catch (error) {
    console.error('Ошибка при парсинге видов компонентов:', error.message);
    throw error;
  }
}

// Функция для получения описания с отдельной страницы
async function fetchDescription(link) {
  try {
    const { data } = await axios.get(`https://www.chipdip.by${link}`);
    const $ = cheerio.load(data);
    return $('.group-desc p:nth-of-type(1)').text().trim();
  } catch (error) {
    console.error(`Ошибка при получении описания для ссылки ${link}:`, error.message);
    return '';
  }
}

module.exports = { scrapeTypes };