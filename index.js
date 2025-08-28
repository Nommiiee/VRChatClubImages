const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const inputDir = "./lillthqueen"; // Base directory containing original PNG images and subdirectories
const outputDir = "./optimised"; // Base directory to save optimized images with replicated structure

// Allowed input image extensions that sharp can process
const supportedImageExtensions = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tiff",
  ".tif",
];

// Function to ensure a directory exists, creating it if necessary
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
};

// Recursive function to optimize and convert images to PNG
async function optimizeAndConvertToPngRecursive(
  currentInputDir,
  currentOutputDir
) {
  ensureDirectoryExists(currentOutputDir);

  const entries = fs.readdirSync(currentInputDir, { withFileTypes: true });

  for (const entry of entries) {
    const inputPath = path.join(currentInputDir, entry.name);

    if (entry.isDirectory()) {
      // If it's a directory, recurse into it
      console.log(`Entering directory: ${inputPath}`);
      const newOutputDir = path.join(currentOutputDir, entry.name);
      await optimizeAndConvertToPngRecursive(inputPath, newOutputDir);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();

      // Check if the file is a supported image format
      if (supportedImageExtensions.includes(ext)) {
        // Construct the output filename, ensuring it's always .png
        const outputFilename = path.parse(entry.name).name + ".png";
        const outputPath = path.join(currentOutputDir, outputFilename);

        try {
          // Get original file size if it exists
          let originalSizeKB = "N/A";
          try {
            const originalStats = fs.statSync(inputPath);
            originalSizeKB = (originalStats.size / 1024).toFixed(2);
          } catch (statError) {
            console.warn(
              `Could not get original size for ${inputPath}: ${statError.message}`
            );
          }

          console.log(`Processing: ${inputPath} -> ${outputPath}`);

          await sharp(inputPath)
            .png({
              quality: 80, // Adjust quality (0-100)
              compressionLevel: 9, // Adjust compression level (0-9)
              effort: 10, // Adjust effort (0-10)
              palette: true, // Use a palette-based approach for images with fewer colors.
              adaptiveFiltering: true, // Use adaptive filtering to improve compression.
            })
            .toFile(outputPath);

          // Get optimized file size
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
            console.warn(
              `Could not get optimized size for ${outputPath}: ${statError.message}`
            );
          }

          console.log(
            `Converted/Optimized: ${inputPath} | Original: ${originalSizeKB}KB | Output: ${optimizedSizeKB}KB | Saved: ${savingsPercentage}%`
          );
        } catch (optimizeError) {
          console.error(`Error processing ${inputPath}:`, optimizeError);
        }
      } else {
        console.log(
          `Skipping (not a supported image format or directory): ${inputPath}`
        );
      }
    }
  }
}

// Start the recursive optimization and conversion process
console.log("Starting recursive image optimization and conversion to PNG...");
optimizeAndConvertToPngRecursive(inputDir, outputDir)
  .then(() => {
    console.log(
      "Recursive image optimization and conversion to PNG completed."
    );
  })
  .catch((error) => {
    console.error("An unhandled error occurred during processing:", error);
  });
