const express = require('express');
const axios = require('axios');  // Добавляем axios для скачивания файлов
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();  // Инициализация Prisma Client

const {
  updateSubtypes,
  updateTypes,
  updateProperties,
  updateComponents,
  getComponent,
} = require('./db');

const {
  findMostSimilarImage
} = require('./ONNX');

const app = express();
const PORT = process.env.PORT || 4000;

// Новый маршрут для получения всех категорий без подкатегорий
app.get('/categoriesType', async (req, res) => {
  try {
    // Получаем все записи из таблицы ComponentType без подкатегорий
    const categories = await prisma.componentType.findMany({
      select: {
        id: true, // ID категории
        type_name: true, // Название категории
        type_description: true, // Описание категории
        type_image: true, // Изображение категории
      }
    });

    // Отправляем данные обратно на мобильное приложение
    res.json(categories); // Возвращаем список категорий в формате JSON
  } catch (error) {
    console.error('Ошибка при получении категорий:', error);
    res.status(500).send('Не удалось получить категории');
  }
});

// Новый маршрут для проксирования PDF
app.get('/getPDF', async (req, res) => {
  const pdfUrl = req.query.url; // Получаем URL PDF из параметра запроса

  if (!pdfUrl) {
    return res.status(400).send('URL параметр не передан');
  }

  try {
    // Запрос к удаленному серверу, чтобы получить PDF
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer', // Получаем файл как массив байтов
    });

    // Отправляем файл обратно с правильным MIME типом
    res.set('Content-Type', 'application/pdf');
    res.send(response.data); // Отправляем данные файла в ответ
  } catch (error) {
    console.error('Ошибка при скачивании PDF:', error);
    res.status(500).send('Не удалось загрузить PDF');
  }
});

// async function startParsers() {
//   console.log('Запуск обновления данных...');
//   updateTypes();
//   updateSubtypes();
//   updateProperties();
//   updateComponents();
// }

// Закрытие соединения с базой данных при завершении работы сервера
process.on('SIGINT', async () => {
  await prisma.$disconnect();  // Закрытие соединения Prisma
  console.log('Соединение с БД закрыто.');
  process.exit(0);
});

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`API сервер запущен на http://localhost:${PORT}`);
  await getComponent(1);
  // const userImageUrl = 'https://static.chipdip.ru/lib/531/DOC009531417.jpg';
  // const catalogImageUrls = [
  // 'https://static.chipdip.ru/lib/531/DOC009531417.jpg',
  // 'https://static.chipdip.ru/lib/642/DOC001642695.jpg',
  // 'https://static.chipdip.ru/lib/304/DOC005304707.jpg',
  // 'https://static.chipdip.ru/lib/304/DOC005304707.jpg',
  // 'https://static.chipdip.ru/lib/221/DOC001221953.jpg'
  // ];

  // // Вызов функции для поиска самого похожего изображения
  // await findMostSimilarImage(userImageUrl, catalogImageUrls).then(result => {
  //     console.log('Most similar image:', result);
  // });
});