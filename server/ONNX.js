const ort = require('onnxruntime-node');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const faiss = require('faiss-node');

const modelPath = path.join(__dirname, 'models', 'adv_inception_v3_Opset18.onnx');
const embeddingsPath = path.join(__dirname, 'image_embeddings.json');

async function loadImageFromPathOrURL(imagePath) {
    let img;
    if (imagePath.startsWith('http')) {
        const response = await axios({ url: imagePath, responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        img = await loadImage(buffer);
    } else {
        img = await loadImage(imagePath); // Загружаем локальный файл
    }

    const canvas = createCanvas(299, 299);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 299, 299);
    return canvas;
}

async function loadModel() {
    return await ort.InferenceSession.create(modelPath);
}

async function imageToTensor(imagePath) {
    const canvas = await loadImageFromPathOrURL(imagePath);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, 299, 299).data;
    const rgbData = [];

    for (let i = 0; i < imageData.length; i += 4) {
        rgbData.push((imageData[i] / 255 - 0.5) / 0.5);
        rgbData.push((imageData[i + 1] / 255 - 0.5) / 0.5);
        rgbData.push((imageData[i + 2] / 255 - 0.5) / 0.5);
    }

    return new ort.Tensor('float32', new Float32Array(rgbData), [1, 3, 299, 299]);
}

async function extractFeatures(model, imagePath) {
    const inputTensor = await imageToTensor(imagePath);
    const feeds = { [model.inputNames[0]]: inputTensor };
    const output = await model.run(feeds);
    return Array.from(output[model.outputNames[0]].data);
}

function saveEmbeddings(embeddings) {
    fs.writeFileSync(embeddingsPath, JSON.stringify(embeddings));
}

function loadEmbeddings() {
    return fs.existsSync(embeddingsPath) ? JSON.parse(fs.readFileSync(embeddingsPath)) : {};
}

async function buildFaissIndex(model, imageUrls) {
    let embeddings = loadEmbeddings();
    let newImages = imageUrls.filter(url => !embeddings[url]);

    if (newImages.length > 0) {
        const newEmbeddings = await Promise.all(newImages.map(url => extractFeatures(model, url)));
        newImages.forEach((url, i) => embeddings[url] = newEmbeddings[i]);
        saveEmbeddings(embeddings);
    }

    const dimension = Object.values(embeddings)[0].length;
    const index = new faiss.IndexFlatL2(dimension);
    const data = Object.values(embeddings).flat();
    index.add(new Float32Array(data));

    return { index, embeddings, imageUrls };
}

async function findMostSimilarImages(targetImagePath, imageUrls, threshold = 0.65, maxResults = 10) {
    const model = await loadModel();
    const { index, imageUrls: dbImageUrls } = await buildFaissIndex(model, imageUrls);
    
    const targetFeatures = await extractFeatures(model, targetImagePath);
    const result = index.search(new Float32Array(targetFeatures), maxResults);

    return result.labels
        .map(idx => dbImageUrls[idx]) // Преобразуем индексы в пути к изображениям
        .filter((_, i) => 1 / (1 + result.distances[i]) >= threshold);
}

module.exports = {
    findMostSimilarImages
};