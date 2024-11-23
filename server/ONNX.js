const ort = require('onnxruntime-node');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const modelPath = path.join(__dirname, 'models', 'adv_inception_v3_Opset18.onnx');

async function loadImageFromURL(imageUrl) {
    const response = await axios({
        url: imageUrl,
        responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvas;
}

async function loadModel() {
    const session = await ort.InferenceSession.create(modelPath);
    console.log("Model inputs:", session.inputNames);
    console.log("Model outputs:", session.outputNames);
    return session;
}

async function imageToTensor(imageUrl) {
    const canvas = await loadImageFromURL(imageUrl);

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

async function extractFeatures(model, imageUrl) {
    const inputTensor = await imageToTensor(imageUrl);
    const feeds = { x: inputTensor };
    const output = await model.run(feeds);
    const outputTensor = output['875'];
    return outputTensor.data;
}

function cosineSimilarity(tensor1, tensor2) {
    const dotProduct = tensor1.reduce((sum, value, i) => sum + value * tensor2[i], 0);
    const norm1 = Math.sqrt(tensor1.reduce((sum, value) => sum + value * value, 0));
    const norm2 = Math.sqrt(tensor2.reduce((sum, value) => sum + value * value, 0));
    return dotProduct / (norm1 * norm2);
}

async function findMostSimilarImage(targetImageUrl, imageUrls) {
    const model = await loadModel();
    const targetFeatures = await extractFeatures(model, targetImageUrl);
    let bestMatchIndex = -1; // Индекс наиболее похожего изображения
    let maxSimilarity = -Infinity;

    for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        const currentFeatures = await extractFeatures(model, imageUrl);
        const similarity = cosineSimilarity(targetFeatures, currentFeatures);
        console.log(`Similarity between ${targetImageUrl} and ${imageUrl}:`, similarity);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestMatchIndex = i; // Сохранение индекса вместо URL
        }
    }

    return bestMatchIndex; // Возвращаем индекс
}

module.exports = {
    findMostSimilarImage
};