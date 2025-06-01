// Simple approach: Try different preprocessing specifically when "left" isn't working
async function getPredictedLabel(processed_t) {
  try {
    console.log("Raw input data:", processed_t);
    
    let flattenedData;
    
    // Handle different input formats (keep existing logic)
    if (Array.isArray(processed_t)) {
      if (processed_t.length === 63) {
        flattenedData = processed_t;
      } else if (processed_t.length === 21) {
        flattenedData = [];
        for (let i = 0; i < processed_t.length; i++) {
          const landmark = processed_t[i];
          if (landmark && typeof landmark === 'object') {
            flattenedData.push(landmark.x || 0);
            flattenedData.push(landmark.y || 0);
            flattenedData.push(landmark.z || 0);
          } else {
            console.error("Invalid landmark format at index", i, landmark);
            return null;
          }
        }
      } else {
        console.error("Invalid tensor data. Expected 21 landmarks or 63 features, got:", processed_t.length);
        return null;
      }
    } else {
      console.error("Invalid tensor data format. Expected array, got:", typeof processed_t);
      return null;
    }
    
    if (flattenedData.length !== 63) {
      console.error("After processing: Expected 63 features, got:", flattenedData.length);
      return null;
    }
    
    // Try primary method first (Method 1 - working for up/down/right)
    let preprocessedData = preprocessMethod1_WristRelative(flattenedData);
    let result = await makePredictionRequest(preprocessedData);
    
    // If we get a valid result, return it
    if (result && result.direction && ["up", "down", "left", "right"].includes(result.direction)) {
      console.log("First attempt successful:", result.direction);
      return result.direction;
    }
    
    // If first attempt failed or gave unexpected result, try alternative methods for fist gesture
    console.log("First attempt result:", result ? result.direction : "null", "- trying alternatives...");
    
    // Method 2: Try Z-score normalization (sometimes works better for fist)
    preprocessedData = preprocessMethod2_ZScore(flattenedData);
    result = await makePredictionRequest(preprocessedData);
    
    if (result && result.direction === "left") {
      console.log("Z-score method worked for left:", result.direction);
      return result.direction;
    }
    
    // Method 3: Try Min-Max scaling
    preprocessedData = preprocessMethod3_MinMax(flattenedData);
    result = await makePredictionRequest(preprocessedData);
    
    if (result && result.direction === "left") {
      console.log("Min-Max method worked for left:", result.direction);
      return result.direction;
    }
    
    // Method 4: Try without any preprocessing (raw data)
    result = await makePredictionRequest(flattenedData);
    
    if (result && result.direction === "left") {
      console.log("Raw data worked for left:", result.direction);
      return result.direction;
    }
    
    // If all methods failed, return the first valid result we got
    const finalResult = await makePredictionRequest(preprocessMethod1_WristRelative(flattenedData));
    return finalResult ? finalResult.direction : null;
    
  } catch (error) {
    console.error('Error calling ML model API:', error);
    return null;
  }
}

// Helper function to make prediction request
async function makePredictionRequest(data) {
  try {
    const requestData = { data: data };
    
    console.log("Making prediction with data stats:");
    console.log("- Range:", Math.min(...data).toFixed(4), "to", Math.max(...data).toFixed(4));
    console.log("- Mean:", (data.reduce((a, b) => a + b) / data.length).toFixed(4));
    
    const response = await fetch('https://xdgnuwvzpzah.ap-southeast-1.clawcloudrun.com/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      return null;
    }
    
    const result = await response.json();
    console.log("API Response:", result);
    
    if (result.error) {
      console.error('API returned error:', result.error);
      return null;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error in makePredictionRequest:', error);
    return null;
  }
}

// Method 1: Wrist-relative normalization (working for other directions)
function preprocessMethod1_WristRelative(flattenedData) {
  const landmarks = [];
  for (let i = 0; i < flattenedData.length; i += 3) {
    landmarks.push({
      x: flattenedData[i],
      y: flattenedData[i + 1],
      z: flattenedData[i + 2]
    });
  }
  
  const wrist = landmarks[0];
  const normalized = landmarks.map(landmark => ({
    x: landmark.x - wrist.x,
    y: landmark.y - wrist.y,
    z: landmark.z - wrist.z
  }));
  
  const result = [];
  for (const landmark of normalized) {
    result.push(landmark.x, landmark.y, landmark.z);
  }
  
  return result;
}

// Method 2: Z-score normalization
function preprocessMethod2_ZScore(flattenedData) {
  const mean = flattenedData.reduce((sum, val) => sum + val, 0) / flattenedData.length;
  const variance = flattenedData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / flattenedData.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return flattenedData;
  
  return flattenedData.map(val => (val - mean) / stdDev);
}

// Method 3: Min-Max scaling
function preprocessMethod3_MinMax(flattenedData) {
  const min = Math.min(...flattenedData);
  const max = Math.max(...flattenedData);
  const range = max - min;
  
  if (range === 0) return flattenedData;
  
  return flattenedData.map(val => (val - min) / range);
}

// Quick test function to try all methods for a single gesture
async function testAllMethodsForCurrentGesture(processed_t) {
  console.log("=== TESTING ALL METHODS FOR CURRENT GESTURE ===");
  
  let flattenedData = [];
  if (processed_t.length === 21) {
    for (let i = 0; i < processed_t.length; i++) {
      const landmark = processed_t[i];
      flattenedData.push(landmark.x, landmark.y, landmark.z);
    }
  } else {
    flattenedData = processed_t;
  }
  
  const methods = [
    { name: "Wrist Relative", func: preprocessMethod1_WristRelative },
    { name: "Z-Score", func: preprocessMethod2_ZScore },
    { name: "Min-Max", func: preprocessMethod3_MinMax },
    { name: "Raw Data", func: (data) => data }
  ];
  
  for (const method of methods) {
    try {
      console.log(`\n--- Testing ${method.name} ---`);
      const processed = method.func(flattenedData);
      const result = await makePredictionRequest(processed);
      console.log(`${method.name} result:`, result ? result.direction : "failed");
    } catch (error) {
      console.error(`${method.name} failed:`, error.message);
    }
  }
}