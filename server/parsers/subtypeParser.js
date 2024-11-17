const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://www.chipdip.by/catalog/electronic-components';

const indexesToRemove = [2, 5, 6, 7, 8, 9, 17, 20, 21]; // Индексы для исключения

// Функция для парсинга подвидов компонентов с сайта
async function scrapeSubtypes() {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    let subtypes = [];
    let types = Array.from($('.catalog__g1.clear')).filter((_, index) => !indexesToRemove.includes(index));

    types.forEach((typeElement, typeId) => {
      const typeSubtypes = $(typeElement).find('.catalog__item a');
      typeSubtypes.each((_, subtypeElement) => {
        const subtypeName = $(subtypeElement).text().trim();

        subtypes.push({
            subtypeName,
            typeId: parseInt(typeId+1)
        });

      });
    });

    return subtypes;
  } catch (error) {
    console.error('Ошибка при парсинге подвидов компонентов:', error.message);
    throw error;
  }
}

module.exports = { scrapeSubtypes };