const videoElement = document.getElementsByClassName("input_video")[0];
const canvasElement = document.getElementsByClassName("output_canvas")[0];
const canvasCtx = canvasElement.getContext("2d");
let arrow = null;

async function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Process only the first detected hand to avoid conflicts
    const landmarks = results.multiHandLandmarks[0];
    
    // Draw the hand landmarks
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 5,
    });
    drawLandmarks(canvasCtx, landmarks, {
      color: "#FF0000",
      lineWidth: 2,
    });
    
    try {
      // Get prediction from the ML model
      const predictedDirection = await getPredictedLabel(landmarks);
      
      if (predictedDirection) {
        console.log("Triggering direction:", predictedDirection);
        triggerArrowKey("keydown", predictedDirection);
        setTimeout(() => {
          triggerArrowKey("keyup", predictedDirection);
        }, 100);
      }
    } catch (error) {
      console.error("Error in gesture prediction:", error);
    }
  }
  
  canvasCtx.restore();
}

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 1, // Changed to 1 to avoid confusion with multiple hands
  modelComplexity: 1,
  minDetectionConfidence: 0.7, // Increased for better accuracy
  minTrackingConfidence: 0.7,  // Increased for better tracking
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 1280,
  height: 720,
});

camera.start();