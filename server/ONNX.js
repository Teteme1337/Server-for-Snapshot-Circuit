const path = require('path');
const fs = require('fs');
const ort = require('onnxruntime-node');
const { createCanvas, loadImage } = require('canvas');
const faiss = require('faiss-node');

const modelPath = path.join(__dirname, 'models', 'adv_inception_v3_Opset18.onnx');
const photosDir = path.join(__dirname, 'photos');

async function loadImageFromFile(imagePath) {
    const img = await loadImage(imagePath);
    const canvas = createCanvas(299, 299);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 299, 299);
    return canvas;
}

async function loadModel() {
    return await ort.InferenceSession.create(modelPath);
}

async function imageToTensor(imagePath) {
    const canvas = await loadImageFromFile(imagePath);
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

async function buildFaissIndex(model) {
    const imageFiles = fs.readdirSync(photosDir)
        .filter(file => file.endsWith('.jpg'))
        .map(file => path.join(photosDir, file));

    const embeddings = await Promise.all(imageFiles.map(file => extractFeatures(model, file)));
    const dimension = embeddings[0].length;
    const index = new faiss.IndexFlatL2(dimension);
    const data = embeddings.flat();
    index.add(new Float32Array(data));

    return { index, imageFiles };
}

async function findMostSimilarImages(targetImagePath, threshold = 0.65, maxResults = 10) {
    const model = await loadModel();
    const { index, imageFiles } = await buildFaissIndex(model);
    
    const targetFeatures = await extractFeatures(model, targetImagePath);
    const result = index.search(new Float32Array(targetFeatures), maxResults);

    return result.labels
        .map(idx => imageFiles[idx])
        .filter((_, i) => 1 / (1 + result.distances[i]) >= threshold);
}

module.exports = {
    findMostSimilarImages
};