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
app.get('/componentSubtype/:subtypeId', async (req, res) => {
  const { subtypeId } = req.params;

  try {
      let components;  

      components = await prisma.components.findMany({
          where: {
            subtype_id: parseInt(subtypeId),
          },
          include: {
            component_properties: true,
            subtype: true,
         },
      });

      if (components.length === 0) {
          return res.status(404).json({ message: "Нет компонентов для данного подтипа" });
      }

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

// Маршрут для запуска Prisma Studio
app.get('/prisma-studio', (req, res) => {
  res.redirect('https://server-for-snapshot-circuit-admin.onrender.com');
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

      // Если пользователь найден, передаем его id
      if (user) {
          res.json({ success: true, id: user.id });
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

//поиск похожего
app.get('/findMostSimilar/:image', async (req, res) => {
  try{
      components = await prisma.components.findMany({
          where: {
              id: { in: [1, 2, 5] }
          },
          include: {
              component_properties: true, // если нужно включить свойства компонентов
              subtype: true, // если нужно включить информацию о подтипе
          },
      });

      if (components.length === 0) {
        return res.status(404).json({ message: "Нет компонентов для данного подтипа" });
      }

    res.json(components);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка на сервере" });
  }
});

//лайк
app.post('/like', async (req, res) => {
  const { userId, componentId } = req.body;

  // Проверяем, существует ли пользователь
  const user = await prisma.users.findUnique({
      where: { id: userId }
  });

  if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
  }

  // Проверяем, существует ли компонент
  const component = await prisma.components.findUnique({
      where: { id: componentId }
  });

  if (!component) {
      return res.status(404).json({ message: 'Компонент не найден' });
  }

  // Проверяем, есть ли уже запись в базе данных
  const existingFavorite = await prisma.favoriteComponents.findUnique({
      where: {
          user_id_component_id: {
              user_id: userId,
              component_id: componentId
          }
      }
  });

  if (existingFavorite) {
      // Если запись существует, удаляем лайк
      await prisma.favoriteComponents.delete({
          where: {
              user_id_component_id: {
                  user_id: userId,
                  component_id: componentId
              }
          }
      });
      return res.json({ message: 'Удалено из избранного' });
  } else {
      // Если записи нет, добавляем лайк
      await prisma.favoriteComponents.create({
          data: {
              user_id: userId,
              component_id: componentId
          }
      });
      return res.json({ message: 'Добавлено в избранное' });
  }
});

app.get('/liked/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
      const likedComponents = await prisma.favoriteComponents.findMany({
          where: {
              user_id: parseInt(userId),
          },
          include: {
              component: {
                  include: {
                      component_properties: true,
                      subtype: true,
                  },
              },
          },
      });

      if (likedComponents.length === 0) {
          return res.status(404).json({ message: "Пользователь не добавил компоненты в избранное" });
      }

      // Извлекаем только информацию о компонентах
      const components = likedComponents.map(fav => fav.component);
      
      res.json(components);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Ошибка на сервере" });
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

//парсеринг
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
  
    // await fetch('http://localhost:4000/like', {
    //   method: 'POST',
    //   headers: {
    //       'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ userId: 1, componentId: 3 })
    // })
    // .then(response => response.json())
    // .then(data => console.log(data))
    // .catch(error => console.error('Ошибка:', error));

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