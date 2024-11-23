const ort = require('onnxruntime-node');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const modelPath = path.join(__dirname, 'models', 'adv_inception_v3_Opset18.onnx');

// Функция для загрузки изображения из Base64
async function loadImageFromBase64(base64) {
    const imgBuffer = Buffer.from(base64, 'base64');
    const img = await loadImage(imgBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvas;
}

// Функция для загрузки модели
async function loadModel() {
    const session = await ort.InferenceSession.create(modelPath);
    console.log("Model inputs:", session.inputNames);
    console.log("Model outputs:", session.outputNames);
    return session;
}

// Функция для преобразования изображения в тензор
async function imageToTensor(imageUrlOrBase64) {
    let canvas;

    if (imageUrlOrBase64.startsWith('data:image/')) {
        // Если передан Base64
        canvas = await loadImageFromBase64(imageUrlOrBase64);
    } else {
        // Если передан URL
        const canvasFromUrl = await loadImageFromURL(imageUrlOrBase64);
        canvas = canvasFromUrl;
    }

    const TARGET_SIZE = 299;
    const resizedCanvas = createCanvas(TARGET_SIZE, TARGET_SIZE);
    const ctx = resizedCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, TARGET_SIZE, TARGET_SIZE);

    const imageData = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE).data;

    const rgbData = [];
    for (let i = 0; i < imageData.length; i += 4) {
        rgbData.push((imageData[i] / 255 - 0.5) / 0.5);
        rgbData.push((imageData[i + 1] / 255 - 0.5) / 0.5);
        rgbData.push((imageData[i + 2] / 255 - 0.5) / 0.5);
    }

    const tensor = new ort.Tensor('float32', new Float32Array(rgbData), [1, 3, TARGET_SIZE, TARGET_SIZE]);
    return tensor;
}

// Функция для извлечения признаков изображения
async function extractFeatures(model, imageUrlOrBase64) {
    const inputTensor = await imageToTensor(imageUrlOrBase64);
    const feeds = { x: inputTensor };
    const output = await model.run(feeds);
    const outputTensor = output['875'];
    return outputTensor.data;
}

// Функция для вычисления косинусного сходства между двумя тензорами
function cosineSimilarity(tensor1, tensor2) {
    const dotProduct = tensor1.reduce((sum, value, i) => sum + value * tensor2[i], 0);
    const norm1 = Math.sqrt(tensor1.reduce((sum, value) => sum + value * value, 0));
    const norm2 = Math.sqrt(tensor2.reduce((sum, value) => sum + value * value, 0));
    return dotProduct / (norm1 * norm2);
}

// Функция для нахождения наиболее похожего изображения
async function findMostSimilarImage(targetImageUrlOrBase64, imageUrlsOrBase64) {
    const model = await loadModel();
    const targetFeatures = await extractFeatures(model, targetImageUrlOrBase64);
    let bestMatchIndex = -1; // Индекс наиболее похожего изображения
    let maxSimilarity = -Infinity;

    // Перебираем все изображения в массиве
    for (let i = 0; i < imageUrlsOrBase64.length; i++) {
        const imageUrlOrBase64 = imageUrlsOrBase64[i];

        const currentFeatures = await extractFeatures(model, imageUrlOrBase64);
        const similarity = cosineSimilarity(targetFeatures, currentFeatures);
        console.log(`Similarity between target image and image ${i}:`, similarity);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestMatchIndex = i; // Сохраняем индекс наиболее похожего изображения
        }
    }

    return bestMatchIndex; // Возвращаем индекс наиболее похожего изображения
}

module.exports = {
    findMostSimilarImage
};
