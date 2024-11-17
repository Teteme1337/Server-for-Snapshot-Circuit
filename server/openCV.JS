const cv = require('opencv4nodejs');

// Функция для вычисления гистограммы изображения
function getHistogram(image) {
    const hist = cv.calcHist([image], [0, 1, 2], new cv.Mat(), new cv.Mat(), [8, 8, 8], [0, 256, 0, 256, 0, 256]);
    return hist.normalize();
}

// Функция для сравнения двух гистограмм
function compareHistograms(hist1, hist2) {
    return cv.compareHist(hist1, hist2, cv.HISTCMP_CORREL);
}

// Основная функция для поиска наиболее похожего изображения
async function findMostSimilarImage(inputImageUrl, imageUrls) {
    // Загружаем входное изображение
    const inputImage = await cv.imreadAsync(inputImageUrl);
    const inputHist = getHistogram(inputImage);

    let maxSimilarity = -1;
    let mostSimilarImageUrl = '';

    for (const url of imageUrls) {
        // Загружаем каждое изображение
        const image = await cv.imreadAsync(url);
        const hist = getHistogram(image);

        // Сравниваем гистограммы
        const similarity = compareHistograms(inputHist, hist);

        // Проверяем, является ли это изображение наиболее похожим
        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            mostSimilarImageUrl = url;
        }
    }

    return mostSimilarImageUrl;
}

// Пример использования
const inputImageUrl = 'path/to/input/image.jpg';
const imageUrls = [
    'path/to/image1.jpg',
    'path/to/image2.jpg',
    'path/to/image3.jpg',
    'path/to/image4.jpg',
    'path/to/image5.jpg'
];

findMostSimilarImage(inputImageUrl, imageUrls)
    .then(result => {
        console.log('Наиболее похожее изображение:', result);
    })
    .catch(err => {
        console.error(err);
    });

// Экспортируем функции
module.exports = {
    findMostSimilarImage
  };