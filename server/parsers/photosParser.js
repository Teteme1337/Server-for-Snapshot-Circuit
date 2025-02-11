// Настройки диапазона загрузки
const startIndex = 3001; // С какого фото начинать (включительно)
const endIndex = 3650;  // Каким фото заканчивать (включительно)

// Функция для скачивания изображения с повторными попытками
const downloadImage = async (url, index, saveDirectory, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!url) {
        console.log(`URL не найден для фото ${index}`);
        return;
      }

      // Получаем данные изображения
      const response = await axios.get(url, { responseType: 'arraybuffer' });

      // Сохраняем изображение
      const filePath = path.join(saveDirectory, `${index}.jpg`);
      fs.writeFileSync(filePath, response.data);
      console.log(`Фото сохранено как ${index}.jpg`);
      return; // Выход из функции после успешного скачивания
    } catch (error) {
      console.error(`Ошибка при скачивании фото ${index}, попытка ${attempt}:`, error.message);

      if (attempt === retries) {
        console.error(`Фото ${index} не удалось скачать после ${retries} попыток.`);
      } else {
        console.log(`Повторная попытка (${attempt + 1}/${retries}) через 3 секунды...`);
        await new Promise(res => setTimeout(res, 3000)); // Ожидание перед повторной попыткой
      }
    }
  }
};

// Функция загрузки фото
const downloadPhotos = async () => {
  console.log(`Запускаем загрузку фото с ${startIndex} по ${endIndex}...`);

  // Получаем фотографии из базы данных
  const componentsPhoto = await prisma.components.findMany({
    select: { id: true, component_photo: true },
    take: endIndex // Загружаем максимум до endIndex записей
  });

  if (!componentsPhoto.length) {
    console.log('⚠️ В базе данных нет фотографий для загрузки.');
    return;
  }

  // Оставляем только нужный диапазон фото
  const selectedPhotos = componentsPhoto.slice(startIndex - 1, endIndex); // Индексы массивов начинаются с 0

  if (!selectedPhotos.length) {
    console.log('⚠️ В выбранном диапазоне нет фотографий.');
    return;
  }

  // Папка для сохранения фотографий
  const saveDirectory = path.join(__dirname, 'photos');

  // Проверяем, существует ли папка, если нет — создаем её
  if (!fs.existsSync(saveDirectory)) {
    fs.mkdirSync(saveDirectory);
  }

  // Скачиваем изображения в заданном диапазоне
  for (let i = 0; i < selectedPhotos.length; i++) {
    const url = selectedPhotos[i].component_photo;
    await downloadImage(url, startIndex + i, saveDirectory); // Начинаем с startIndex
  }

  console.log('✅ Все фото загружены.');
};