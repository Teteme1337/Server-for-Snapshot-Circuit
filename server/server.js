const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
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
app.use(express.json());
const PORT = process.env.PORT || 4000;

// Новый маршрут для получения категорий с подкатегориями
app.get('/componentType', async (req, res) => {
  try {
    // Получаем все записи из таблицы ComponentType с подкатегориями
    const categories = await prisma.componentType.findMany({
      include: {
        subtypes: true, // Включаем подкатегории
      },
    });

    // Отправляем данные обратно на мобильное приложение
    res.json(categories); // Возвращаем список категорий с подкатегориями в формате JSON
  } catch (error) {
    console.error('Ошибка при получении категорий:', error);
    res.status(500).send('Не удалось получить категории');
  }
});

// Получение типа компонента по ID
app.get('/componentType/:id', async (req, res) => {
  const { id } = req.params; // Получаем ID типа компонента из URL

  try {
    const componentType = await prisma.componentType.findUnique({
      where: { id: parseInt(id) }, // Ищем тип по ID
      include: {
        subtypes: true, // Включаем подтипы, если нужно
      },
    });

    if (!componentType) {
      return res.status(404).send('Тип компонента не найден');
    }

    // Отправляем информацию о типе компонента
    res.json(componentType);
  } catch (error) {
    console.error('Ошибка при получении типа компонента:', error);
    res.status(500).send('Ошибка на сервере');
  }
});

// Эндпоинт для получения компонентов по id подтипа
app.get('/components/:subtypeId', async (req, res) => {
  const { subtypeId } = req.params;

  try {
      // Запрос в базу данных для получения всех компонентов для данного подтипа
      const components = await prisma.components.findMany({
          where: {
              subtype_id: parseInt(subtypeId),
          },
          include: {
              component_properties: true, // если нужно включить свойства компонентов
              subtype: true, // если нужно включить информацию о подтипе
          },
      });

      if (components.length === 0) {
          return res.status(404).json({ message: "Нет компонентов для данного подтипа" });
      }

      // Возвращаем компоненты
      res.json(components);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Ошибка на сервере" });
  }
});

app.get('/component/:id', async (req, res) => {
  const { id } = req.params; // Получаем ID компонента из URL

  try {
    // Ищем компонент в базе данных по ID
    const component = await prisma.components.findUnique({
      where: { id: parseInt(id) }, // Ищем компонент по ID
      include: {
        component_properties: true,
        subtype: true,
      },
    });

    // Если компонент не найден, возвращаем ошибку
    if (!component) {
      return res.status(404).send('Компонент не найден');
    }

    // Отправляем компонент в ответ
    res.json(component);
  } catch (error) {
    console.error('Ошибка при получении компонента:', error);
    res.status(500).send('Ошибка на сервере');
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

// Маршрут для запуска Prisma Studio
app.get('/prisma-studio', (req, res) => {
  exec('npx prisma studio --port=10001', (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка запуска Prisma Studio: ${error.message}`);
      return res.status(500).send('Ошибка при запуске Prisma Studio');
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
    }
    console.log(`Stdout: ${stdout}`);
    res.send('Prisma Studio запущена на http://localhost:10001');
  });
});

// Вход
app.post('/login', async (req, res) => {
  try {
      const { email, password } = req.body;

      const user = await prisma.users.findFirst({
          where: {
              email: email,
              password: password,
          },
      });

      // Если пользователь найден
      if (user) {
          res.json({ success: true });
      } else {
          res.json({ success: false });
      }
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Регистрация
app.post('/register', async (req, res) => {
  try {
      const { email, password } = req.body; // Получение email и password из тела запроса

      // Проверяем, существует ли пользователь с указанным email
      const existingUser = await prisma.users.findFirst({
          where: { email: email },
      });

      if (existingUser) {
          // Если пользователь уже существует
          res.json({ success: false, message: 'Пользователь с таким email уже существует' });
      } else {
          // Если пользователь не найден, создаем нового
          await prisma.users.create({
              data: {
                  email: email,
                  password: password, // Важно: пароли должны храниться в зашифрованном виде
              },
          });

          res.json({ success: true, message: 'Регистрация успешна' });
      }
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// app.post('/find-most-similar', async (req, res) => {
//   const { targetImageUrl } = req.body;

//   if (!targetImageUrl) {
//       return res.status(400).json({ error: 'URL изображения обязателен.' });
//   } else {
//     console.log(targetImageUrl);
//   }


//   try {
//       // Извлечение изображений из таблицы Components

//       const components = await prisma.components.findMany({
//           select: {
//               component_photo: true, // Берём только URL изображения
//           },
//       });

//       // Создание массива URL-ов
//       const imageUrls = components.map(component => component.component_photo);

//       // Используем findMostSimilarImage для поиска наиболее похожего
//       const mostSimilarIndex = await findMostSimilarImage(targetImageUrl, imageUrls);

//       // Возвращаем только индекс
//       return res.json(mostSimilarIndex+1);
//   } catch (error) {
//       console.error('Ошибка при обработке запроса:', error);
//       return res.status(500).json({ error: 'Ошибка на сервере. Проверьте лог сервера.' });
//   }
// });

app.post('/find-most-similar', async (req, res) => {
  const { targetImageUrl } = req.body;

  if (!targetImageUrl) {
      return res.status(400).json({ error: 'URL изображения обязателен.' });
  }

  // Выводим Base64 строку в консоль
  console.log("Base64 Image: ", targetImageUrl);

  // Отправляем успешный ответ
  res.status(200).json({ message: "Base64 изображение получено!" });
});


async function startParsers() {
  console.log('Запуск обновления данных...');
  updateTypes();
  updateSubtypes();
  updateProperties();
  updateComponents();
}

// Закрытие соединения с базой данных при завершении работы сервера
process.on('SIGINT', async () => {
  await prisma.$disconnect();  // Закрытие соединения Prisma
  console.log('Соединение с БД закрыто.');
  process.exit(0);
});

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`API сервер запущен на http://localhost:${PORT}`);
  //await getComponent(1);
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