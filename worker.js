// worker.js
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { parentPort } = require("worker_threads");

parentPort.on("message", async (task) => {
  const { inputPath, outputPath } = task;

  try {
    let originalSizeKB = "N/A";
    try {
      const originalStats = fs.statSync(inputPath);
      originalSizeKB = (originalStats.size / 1024).toFixed(2);
    } catch (statError) {
      // Ignore if stat fails, as it might be a new file or access issue
    }

    await sharp(inputPath)
      .png({
        quality: 80,
        compressionLevel: 9,
        effort: 10,
        palette: true,
        adaptiveFiltering: true,
      })
      .toFile(outputPath);

    let optimizedSizeKB = "N/A";
    let savingsPercentage = "N/A";

    try {
      const optimizedStats = fs.statSync(outputPath);
      optimizedSizeKB = (optimizedStats.size / 1024).toFixed(2);
      if (originalSizeKB !== "N/A") {
        const originalSize = parseFloat(originalSizeKB) * 1024;
        const optimizedSize = optimizedStats.size;
        if (originalSize > 0) {
          savingsPercentage = (
            ((originalSize - optimizedSize) / originalSize) *
            100
          ).toFixed(2);
        }
      }
    } catch (statError) {
      // Ignore if stat fails
    }

    parentPort.postMessage({
      status: "completed",
      inputPath,
      outputPath,
      originalSizeKB,
      optimizedSizeKB,
      savingsPercentage,
    });
  } catch (error) {
    parentPort.postMessage({
      status: "error",
      inputPath,
      error: error.message,
    });
  }
});
