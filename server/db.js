const { PrismaClient } = require('@prisma/client');
const { scrapeSubtypes } = require('./parsers/subtypeParser');
const { scrapeTypes } = require('./parsers/typeParser');
const { scrapeProperties } = require('./parsers/propertiesParser');
const { scrapeComponents } = require('./parsers/componentsParser');

const prisma = new PrismaClient();

// Функция для обновления данных в таблице ComponentType
async function updateTypes() {
  try {
    const types = await scrapeTypes();
    await prisma.componentType.deleteMany(); // Очищаем таблицу

    await prisma.componentType.createMany({
      data: types.map(({ typeName, typeImage, description }) => ({
        type_name: typeName,
        type_image: typeImage,
        type_description: description,
      })),
    });

    console.log('Таблица ComponentType обновлена.');
  } catch (error) {
    console.error('Ошибка при обновлении ComponentType:', error.message);
  }
}

// Функция для обновления данных в таблице ComponentSubtype
async function updateSubtypes() {
  try {
    const subtypes = await scrapeSubtypes();
    await prisma.componentSubtype.deleteMany(); // Очищаем таблицу

    await prisma.componentSubtype.createMany({
      data: subtypes.map(({ subtypeName, typeId }) => ({
        subtype_name: subtypeName,
        type_id: typeId,
      })),
    });

    console.log('Таблица ComponentSubtype обновлена.');
  } catch (error) {
    console.error('Ошибка при обновлении ComponentSubtype:', error.message);
  }
}

// Функция для обновления данных в таблице ComponentProperties
async function updateProperties() {
  try {
    const properties = await scrapeProperties();
    await prisma.componentProperties.deleteMany(); // Очищаем таблицу

    await prisma.componentProperties.createMany({
      data: properties.map(({ name, value, num }) => ({
        property_name: name,
        property_value: value,
        component_id: num,
      })),
    });

    console.log('Таблица ComponentProperties обновлена.');
  } catch (error) {
    console.error('Ошибка при обновлении ComponentProperties:', error.message);
  }
}

// Функция для обновления данных в таблице Components
async function updateComponents() {
  try {
    const components = await scrapeComponents();
    await prisma.components.deleteMany(); // Очищаем таблицу

    await prisma.components.createMany({
      data: components.map(({ title, componentPhoto, description, documentationName, subtypeId }) => ({
        title,
        component_photo: componentPhoto,
        description,
        documentation_name: documentationName,
        subtype_id: subtypeId,
      })),
    });

    console.log('Таблица Components обновлена.');
  } catch (error) {
    console.error('Ошибка при обновлении Components:', error.message);
  }
}

// Получение данных о компоненте, его свойствах, подтипе и типе
async function getComponent(id) {
  try {
    const component = await prisma.components.findUnique({
      where: { id },
      include: {
        subtype: {
          include: {
            type: true, // Включаем данные о типе
          },
        },
        component_properties: true, // Включаем свойства компонента
      },
    });

    if (component) {
      console.log('Данные из Components:', component);
    } else {
      console.log(`Компонент с id ${id} не найден.`);
    }
  } catch (error) {
    console.error('Ошибка при получении данных о компоненте:', error.message);
  }
}

// Экспортируем функции
module.exports = {
  updateSubtypes,
  updateTypes,
  updateProperties,
  updateComponents,
  getComponent
};