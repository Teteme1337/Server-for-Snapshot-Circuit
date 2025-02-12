const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs'); // Import fs module for file operations
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Папка для хранения загруженных изображений
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Генерация уникального имени файла
  },
});
const upload = multer({ storage: storage });
const path = require('path');
const prisma = new PrismaClient();  // Инициализация Prisma Client
const ort = require('onnxruntime-node');
const cliProgress = require('cli-progress');
const { createCanvas, loadImage } = require('canvas');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 4000;

app.get("/healthcheck", (req, res) => {
  res.status(200).send("OK");
});

app.get('/admin', (req, res) => {
  res.send('https://server-for-snapshot-circuit-1.onrender.com');
});

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

// Закрытие соединения с базой данных при завершении работы сервера
process.on('SIGINT', async () => {
  await prisma.$disconnect();  // Закрытие соединения Prisma
  console.log('Соединение с БД закрыто.');
  process.exit(0);
});


const modelPath = path.join(__dirname, 'models', 'adv_inception_v3_Opset18.onnx');
const photosDir = path.join(__dirname, 'photos');

let model;
let faissIndex;
let imageFiles = [];

// Функция загрузки модели
async function loadModel() {
    console.log("Загрузка модели...");
    model = await ort.InferenceSession.create(modelPath);
    console.log("Модель загружена.");
}

// Функция загрузки изображения и конвертации в тензор
async function imageToTensor(imagePath) {
    const img = await loadImage(imagePath);
    const canvas = createCanvas(299, 299);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 299, 299);
    const imageData = ctx.getImageData(0, 0, 299, 299).data;
    
    const rgbData = [];
    for (let i = 0; i < imageData.length; i += 4) {
        rgbData.push((imageData[i] / 255 - 0.5) / 0.5);
        rgbData.push((imageData[i + 1] / 255 - 0.5) / 0.5);
        rgbData.push((imageData[i + 2] / 255 - 0.5) / 0.5);
    }

    return new ort.Tensor('float32', new Float32Array(rgbData), [1, 3, 299, 299]);
}

// Функция извлечения признаков изображения
async function extractFeatures(imagePath) {
    const inputTensor = await imageToTensor(imagePath);
    const feeds = { [model.inputNames[0]]: inputTensor };
    const output = await model.run(feeds);
    return Array.from(output[model.outputNames[0]].data);
}

async function buildFaissIndex(model) {
  console.log("Начинаем создание Faiss-индекса...");
  const imageFiles = fs.readdirSync(photosDir)
      .filter(file => file.endsWith('.jpg'))
      .map(file => path.join(photosDir, file));

  console.log(`Найдено ${imageFiles.length} изображений.`);

  let embeddings = [];
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(imageFiles.length, 0);
  console.log("\n");

  for (let i = 0; i < imageFiles.length; i++) {
      try {
          const feature = await extractFeatures(model, imageFiles[i]);
          embeddings.push(feature);
          progressBar.update(i + 1);
      } catch (error) {
          console.error(`Ошибка обработки изображения ${imageFiles[i]}:`, error);
      }
  }

  progressBar.stop();
  console.log("Все изображения обработаны!");

  const dimension = embeddings[0].length;
  const index = new faiss.IndexFlatL2(dimension);
  const data = embeddings.flat();
  index.add(new Float32Array(data));

  console.log("Faiss-индекс успешно создан!");
  return { index, imageFiles };
}

async function findMostSimilarImages(targetImagePath, threshold = 0.65, maxResults = 10) {
    if (!fs.existsSync(targetImagePath)) {
        throw new Error(`Изображение по пути ${targetImagePath} не найдено.`);
    }

    if (!faissIndex) {
        throw new Error("Faiss-индекс не загружен!");
    }

    try {
        // Извлекаем признаки для целевого изображения
        const targetFeatures = await extractFeatures(targetImagePath);

        // Ищем похожие изображения с использованием Faiss
        const result = faissIndex.search(new Float32Array(targetFeatures), maxResults);

        // Возвращаем список похожих изображений, удовлетворяющих порогу
        return result.labels
            .map(idx => imageFiles[idx])
            .filter((_, i) => 1 / (1 + result.distances[i]) >= threshold);
    } catch (error) {
        console.error("Ошибка при поиске похожих изображений:", error);
        throw new Error("Ошибка при обработке запроса на поиск похожих изображений.");
    }
}

// Обработчик загрузки и поиска похожих изображений
app.post("/findMostSimilar", upload.single("image"), async (req, res) => {
    // if (!req.file) {
    //     return res.status(400).send("No file uploaded.");
    // }

    // console.log("Received file:", req.file.path);

    // try {
    //     const similarImages = await findMostSimilarImages(req.file.path);

    //     if (similarImages.length === 0) {
    //         return res.status(404).json({ message: "Не найдено похожих изображений" });
    //     }

    //     res.json(similarImages);
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

// Запуск сервера с предварительной загрузкой модели и индекса
app.listen(PORT, async () => {
  console.log(`API сервер запущен на http://localhost:${PORT}`);

  // try {
  //     await loadModel(); // Загружаем модель
  //     await buildFaissIndex(); // Создаем индекс

  //     // Тестируем findMostSimilarImages
  //     const testImagePath = "uploads/test.jpg";

  //     if (fs.existsSync(testImagePath)) {
  //         console.log("Тестируем поиск похожих изображений...");
  //         const result = await findMostSimilarImages(testImagePath);
  //         console.log("Результаты теста:", result);
  //     } else {
  //         console.log(`Файл для теста ${testImagePath} не найден.`);
  //     }
  // } catch (error) {
  //     console.error("Ошибка инициализации:", error);
  // }
});