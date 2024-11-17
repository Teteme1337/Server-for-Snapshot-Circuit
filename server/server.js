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

const app = express();
const PORT = 3000;

// Новый маршрут для проксирования PDF
app.get('/proxy', async (req, res) => {
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
  getComponent(1);
});