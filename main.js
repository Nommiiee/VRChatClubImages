// main.js (or your original script name)
const sharp = require("sharp"); // Keep for type definitions/potential synchronous use, though workers will handle processing
const fs = require("fs");
const path = require("path");
const { Worker, isMainThread, parentPort } = require("worker_threads");
const os = require("os");

const inputDir = "./lillthqueen"; // Base directory containing original PNG images and subdirectories
const outputDir = "./optimised"; // Base directory to save optimized images with replicated structure

const supportedImageExtensions = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tiff",
  ".tif",
];

// Determine the number of workers to use (e.g., CPU cores - 1, or a fixed number)
// A common practice is to leave one core for the main thread.
const NUM_WORKERS = Math.max(1, os.cpus().length - 1);
const workers = [];
const taskQueue = [];
let activeWorkers = 0;
let filesToProcess = 0;
let filesProcessed = 0;

// Function to ensure a directory exists, creating it if necessary
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
};

// Initialize worker pool
function initializeWorkers() {
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(path.join(__dirname, "worker.js"));
    worker.on("message", handleWorkerMessage);
    worker.on("error", (err) =>
      console.error(`Worker ${worker.threadId} error:`, err)
    );
    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`Worker ${worker.threadId} exited with code ${code}`);
      }
    });
    workers.push(worker);
  }
  console.log(`Initialized ${NUM_WORKERS} worker threads.`);
}

// Handle messages from workers
function handleWorkerMessage(message) {
  filesProcessed++;
  activeWorkers--;

  if (message.status === "completed") {
    console.log(
      `Converted/Optimized: ${message.inputPath} | Original: ${message.originalSizeKB}KB | Output: ${message.optimizedSizeKB}KB | Saved: ${message.savingsPercentage}%`
    );
  } else if (message.status === "error") {
    console.error(`Error processing ${message.inputPath}:`, message.error);
  }

  // Check if there are more tasks in the queue
  if (taskQueue.length > 0) {
    assignTaskToWorker(this); // Assign next task to the just-freed worker
  } else if (filesProcessed === filesToProcess) {
    // All tasks completed
    console.log(
      "Recursive image optimization and conversion to PNG completed."
    );
    // Terminate all workers
    workers.forEach((worker) => worker.terminate());
  }
}

// Assign a task to an available worker
function assignTaskToWorker(worker) {
  if (taskQueue.length > 0) {
    activeWorkers++;
    const task = taskQueue.shift();
    console.log(`Assigning task for ${task.inputPath} to a worker.`);
    worker.postMessage(task);
  }
}

// Recursive function to find images and add them to the task queue
async function findImagesRecursive(currentInputDir, currentOutputDir) {
  ensureDirectoryExists(currentOutputDir);

  const entries = fs.readdirSync(currentInputDir, { withFileTypes: true });

  for (const entry of entries) {
    const inputPath = path.join(currentInputDir, entry.name);

    if (entry.isDirectory()) {
      console.log(`Entering directory: ${inputPath}`);
      const newOutputDir = path.join(currentOutputDir, entry.name);
      await findImagesRecursive(inputPath, newOutputDir);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();

      if (supportedImageExtensions.includes(ext)) {
        const outputFilename = path.parse(entry.name).name + ".png";
        const outputPath = path.join(currentOutputDir, outputFilename);
        taskQueue.push({ inputPath, outputPath });
        filesToProcess++;
      } else {
        console.log(
          `Skipping (not a supported image format or directory): ${inputPath}`
        );
      }
    }
  }
}

// Main execution flow
async function startProcessing() {
  console.log("Starting recursive image optimization and conversion to PNG...");

  // First, find all files and populate the task queue
  await findImagesRecursive(inputDir, outputDir);

  if (filesToProcess === 0) {
    console.log("No images found to process.");
    return;
  }

  initializeWorkers();

  // Distribute initial tasks to available workers
  for (let i = 0; i < NUM_WORKERS && taskQueue.length > 0; i++) {
    assignTaskToWorker(workers[i]);
  }

  // If there are more tasks than workers, they will be picked up
  // by workers once they complete their current task.
}

startProcessing().catch((error) => {
  console.error("An unhandled error occurred during processing:", error);
  // Ensure workers are terminated on error
  workers.forEach((worker) => worker.terminate());
});
