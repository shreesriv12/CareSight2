'use client';

import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function EyeGazeControlPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const gazeStartTimeRef = useRef(null);
  const lastGazedButtonRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [gazeControlEnabled, setGazeControlEnabled] = useState(false); // NEW state
  const [gazeDirection, setGazeDirection] = useState({ x: 0.5, y: 0.5 });
  const [selectedButton, setSelectedButton] = useState(null);
  const [gazeProgress, setGazeProgress] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [currentCalibrationPoint, setCurrentCalibrationPoint] = useState(0);
  const [activatedButton, setActivatedButton] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [mappingParams, setMappingParams] = useState({ a_x: 1, b_x: 0, a_y: 1, b_y: 0 });

  // Emotion detection states
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [emotionConfidence, setEmotionConfidence] = useState(0);
  const [emotionStats, setEmotionStats] = useState({});
  const [showEmotionDetails, setShowEmotionDetails] = useState(false);
  const [emotionAlerts, setEmotionAlerts] = useState([]);

  const [emotionBuffer, setEmotionBuffer] = useState([]);
  const [lastEmotionUpdate, setLastEmotionUpdate] = useState(0);
  const [isEmotionProcessing, setIsEmotionProcessing] = useState(false);

  const EMOTION_DETECTION_DELAY = 2500; // 2.5 seconds delay
  const EMOTION_BUFFER_SIZE = 15; // Number of frames to buffer (25 frames = 2.5 seconds at 100ms intervals)
  const EMOTION_STABILITY_THRESHOLD = 0.6; // 60% of frames must have the same emotion


  const GAZE_THRESHOLD = 2000;
  const EMOTION_HISTORY_LIMIT = 10;
  const EMOTION_CONFIDENCE_THRESHOLD = 0.3;

  const CALIBRATION_POINTS = [
    { x: 0.1, y: 0.1, label: 'Top Left' },
    { x: 0.9, y: 0.1, label: 'Top Right' },
    { x: 0.5, y: 0.5, label: 'Center' },
    { x: 0.1, y: 0.9, label: 'Bottom Left' },
    { x: 0.9, y: 0.9, label: 'Bottom Right' },
  ];

  const EMOTION_COLORS = {
    happy: '#22c55e',
    sad: '#3b82f6',
    angry: '#ef4444',
    fearful: '#a855f7',
    disgusted: '#eab308',
    surprised: '#f97316',
    neutral: '#6b7280',
  };

  const EMOTION_ICONS = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    fearful: '😨',
    disgusted: '🤢',
    surprised: '😲',
    neutral: '😐',
  };

  const buttons = [
    { id: 'call-nurse', label: 'Call Nurse', icon: '👩‍⚕️', color: 'bg-red-500' },
    { id: 'water', label: 'Water', icon: '💧', color: 'bg-blue-500' },
    { id: 'food', label: 'Food', icon: '🍽️', color: 'bg-green-500' },
    { id: 'pain', label: 'Pain', icon: '😣', color: 'bg-orange-500' },
    { id: 'bathroom', label: 'Bathroom', icon: '🚽', color: 'bg-purple-500' },
    { id: 'tv', label: 'TV Control', icon: '📺', color: 'bg-gray-500' },
    { id: 'scroll-up', label: 'Scroll Up', icon: '⬆️', color: 'bg-indigo-500' },
    { id: 'scroll-down', label: 'Scroll Down', icon: '⬇️', color: 'bg-indigo-500' },
    { id: 'section1-action', label: 'Section 1 Action', icon: '🔧', color: 'bg-teal-500' },
    { id: 'section2-action', label: 'Section 2 Action', icon: '⚙️', color: 'bg-cyan-500' },
  ];

  // Removed initial loadModels call from useEffect.
  // It will now be triggered by handleStartGazeControl.

  const loadModels = async () => {
    console.log('Attempting to load Face-API models...');
    try {
      console.log('Trying to load models from remote URL...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
        faceapi.nets.faceExpressionNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
      ]);
      setIsLoaded(true);
      console.log('Successfully loaded models from remote URL.');
    } catch (error) {
      console.error('Error loading models from remote URL:', error);
      console.log('Falling back to local /models directory...');
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
        ]);
        setIsLoaded(true);
        console.log('Successfully loaded models from local /models directory.');
      } catch (localError) {
        console.error('Error loading models from local /models directory:', localError);
        showNotification('❌ Failed to load face detection models. Please ensure the /public/models directory is correctly set up, or check your internet connection.', 'error');
        // Prevent gaze control from enabling if models fail to load entirely
        setGazeControlEnabled(false);
      }
    }
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        showNotification('✅ Camera access granted!', 'success');
        return true; // Indicate success
      }
      return false;
    } catch (error) {
      console.error('Error accessing camera:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        showNotification('🚫 Camera access denied. Please allow camera permissions in your browser settings to use gaze control.', 'error');
      } else if (error.name === 'NotFoundError') {
        showNotification('🚫 No camera found. Please ensure a camera is connected.', 'error');
      } else {
        showNotification('❌ Failed to access camera. ' + error.message, 'error');
      }
      return false; // Indicate failure
    }
  };

  // NEW: Function to handle the user's initial click
  const handleStartGazeControl = async () => {
    showNotification('Starting gaze control...', 'info');
    const videoStarted = await startVideo();
    if (videoStarted) {
      await loadModels(); // Load models only after video starts successfully
      if (isLoaded) { // Check if models actually loaded
        setGazeControlEnabled(true);
        showNotification('🚀 Gaze control ready! Look at a button to activate.', 'success');
      } else {
        showNotification('❗ Models failed to load, gaze control cannot start.', 'error');
      }
    } else {
      showNotification('❗ Camera could not be accessed, gaze control cannot start.', 'error');
    }
  };


  const processEmotions = (expressions) => {
    if (!expressions) return;

    const now = Date.now();
    const emotionEntries = Object.entries(expressions);
    const dominantEmotion = emotionEntries.reduce((prev, current) =>
      prev[1] > current[1] ? prev : current
    );

    const [emotion, confidence] = dominantEmotion;

    // Only process if confidence is above threshold
    if (confidence > EMOTION_CONFIDENCE_THRESHOLD) {
      // Add to emotion buffer
      setEmotionBuffer(prev => {
        const newBuffer = [...prev, { emotion, confidence, timestamp: now }];
        // Keep only the last EMOTION_BUFFER_SIZE frames
        return newBuffer.slice(-EMOTION_BUFFER_SIZE);
      });

      // Check if enough time has passed since last emotion update
      if (now - lastEmotionUpdate >= EMOTION_DETECTION_DELAY) {
        setIsEmotionProcessing(true);

        // Analyze the emotion buffer for stability
        setTimeout(() => {
          setEmotionBuffer(currentBuffer => {
            if (currentBuffer.length >= EMOTION_BUFFER_SIZE) {
              const stableEmotion = analyzeEmotionStability(currentBuffer);

              if (stableEmotion) {
                // Update the displayed emotion only if it's stable
                setCurrentEmotion(stableEmotion.emotion);
                setEmotionConfidence(stableEmotion.confidence);

                // Add to history
                setEmotionHistory(prev => {
                  const newHistory = [...prev, {
                    emotion: stableEmotion.emotion,
                    confidence: stableEmotion.confidence,
                    timestamp: now
                  }];
                  return newHistory.slice(-EMOTION_HISTORY_LIMIT);
                });

                // Update stats
                setEmotionStats(prev => ({
                  ...prev,
                  [stableEmotion.emotion]: (prev[stableEmotion.emotion] || 0) + 1,
                }));

                // Check for alerts
                checkEmotionAlerts(stableEmotion.emotion, stableEmotion.confidence, stableEmotion.stability); // Pass stability

                setLastEmotionUpdate(now);
              }
            }

            setIsEmotionProcessing(false);
            return currentBuffer;
          });
        }, 50); // Small delay
      }
    }
  };

  const analyzeEmotionStability = (buffer) => {
    if (buffer.length < EMOTION_BUFFER_SIZE) return null;

    const emotionCounts = {};
    let totalConfidence = {};

    buffer.forEach(({ emotion, confidence }) => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      totalConfidence[emotion] = (totalConfidence[emotion] || 0) + confidence;
    });

    const mostFrequentEmotion = Object.entries(emotionCounts)
      .reduce((prev, current) => prev[1] > current[1] ? prev : current);

    const [emotion, count] = mostFrequentEmotion;
    const stability = count / buffer.length;

    if (stability >= EMOTION_STABILITY_THRESHOLD) {
      const averageConfidence = totalConfidence[emotion] / count;
      return {
        emotion,
        confidence: averageConfidence,
        stability,
        count
      };
    }

    return null;
  };


  const checkEmotionAlerts = (emotion, confidence, stability = 0) => {
    const alerts = [];

    if (['sad', 'angry', 'fearful', 'disgusted'].includes(emotion) && confidence > 0.6) {
      alerts.push({
        type: 'distress',
        message: `Stable ${emotion} detected (${(confidence * 100).toFixed(1)}% confidence)`,
        emotion,
        confidence,
        stability,
        timestamp: Date.now()
      });
    }

    const recentEmotions = emotionHistory.slice(-EMOTION_HISTORY_LIMIT);
    const negativeEmotionsInHistory = recentEmotions.filter((e) =>
      ['sad', 'angry', 'fearful', 'disgusted'].includes(e.emotion) && e.confidence > 0.5
    );

    if (negativeEmotionsInHistory.length >= Math.ceil(EMOTION_HISTORY_LIMIT * 0.7)) {
      alerts.push({
        type: 'prolonged_distress',
        message: 'Prolonged negative emotions detected!',
        emotion: 'multiple',
        confidence: 0.8,
        stability: 1.0,
        timestamp: Date.now()
      });
    }

    if (alerts.length > 0) {
      alerts.forEach(newAlert => {
        const isDuplicate = emotionAlerts.some(existingAlert =>
          existingAlert.type === newAlert.type &&
          existingAlert.emotion === newAlert.emotion &&
          (Date.now() - existingAlert.timestamp < 30000)
        );

        if (!isDuplicate) {
          setEmotionAlerts(prev => [...prev, newAlert]);
          showNotification(`🚨 ${newAlert.message}`, 'warning');
          setTimeout(() => {
            setEmotionAlerts(prev => prev.filter(alert => alert !== newAlert));
          }, 10000);
        }
      });
    }
  };


  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current || !gazeControlEnabled) return; // Added gazeControlEnabled check

    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;
    const zoomLevel = window.devicePixelRatio || 1;

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let screenX = gazeDirection.x;
    let screenY = gazeDirection.y;

    if (detection) {
      setFaceDetected(true);

      processEmotions(detection.expressions);

      const box = detection.detection.box;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      if (currentEmotion) {
        const emotionColor = EMOTION_COLORS[currentEmotion] || '#6b7280';
        ctx.fillStyle = emotionColor;
        ctx.fillRect(box.x, box.y - 30, box.width, 25);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${EMOTION_ICONS[currentEmotion]} ${currentEmotion} ${(emotionConfidence * 100).toFixed(0)}%`,
          box.x + box.width / 2,
          box.y - 10
        );
      }

      const landmarks = detection.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();

      const leftEyeCenter = getEyeCenter(leftEye);
      const rightEyeCenter = getEyeCenter(rightEye);

      const gazeX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
      const gazeY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

      const SENSITIVITY = 2.5;
      let normalizedX = Math.min(Math.max(1 - gazeX / canvas.width, 0), 1);
      let normalizedY = Math.min(Math.max(gazeY / canvas.height, 0), 1);
      let adjustedX = (normalizedX - 0.5) * SENSITIVITY + 0.5;
      let adjustedY = (normalizedY - 0.5) * SENSITIVITY + 0.5;
      screenX = isCalibrated ? mappingParams.a_x * adjustedX + mappingParams.b_x : adjustedX;
      screenY = isCalibrated ? mappingParams.a_y * adjustedY + mappingParams.b_y : adjustedY;
      screenX = Math.min(Math.max(screenX, 0), 1);
      screenY = Math.min(Math.max(screenY, 0), 1);

      setGazeDirection({ x: screenX, y: screenY });

      checkButtonGaze(screenX, screenY);
    } else {
      setFaceDetected(false);
      setCurrentEmotion(null);
      setEmotionConfidence(0);
      resetGazeTracking();
    }

    overlayCtx.fillStyle = '#ff0000';
    overlayCtx.beginPath();
    overlayCtx.arc(
      screenX * window.innerWidth * zoomLevel,
      screenY * window.innerHeight * zoomLevel,
      15,
      0,
      2 * Math.PI
    );
    overlayCtx.fill();

    if (isCalibrating) {
      overlayCtx.fillStyle = '#00ff00';
      overlayCtx.beginPath();
      overlayCtx.arc(
        screenX * window.innerWidth * zoomLevel,
        screenY * window.innerHeight * zoomLevel,
        7,
        0,
        2 * Math.PI
      );
      overlayCtx.fill();
    }
  };

  const getEyeCenter = (eyePoints) => {
    const x = eyePoints.reduce((sum, point) => sum + point.x, 0) / eyePoints.length;
    const y = eyePoints.reduce((sum, point) => sum + point.y, 0) / eyePoints.length;
    return { x, y };
  };

  const checkButtonGaze = (gazeX, gazeY) => {
    const buttonElements = document.querySelectorAll('.gaze-button');
    let foundButton = null;
    let minDistance = Infinity;
    let debugText = `Gaze: (${gazeX.toFixed(2)}, ${gazeY.toFixed(2)}) - `;

    const zoomLevel = window.devicePixelRatio || 1;
    const viewportX = gazeX * window.innerWidth;
    const viewportY = gazeY * window.innerHeight;

    buttonElements.forEach((button, index) => {
      const rect = button.getBoundingClientRect();

      const buttonCenterX = rect.left + rect.width / 2;
      const buttonCenterY = rect.top + rect.height / 2;
      const distance = Math.sqrt(
        Math.pow(viewportX - buttonCenterX, 2) + Math.pow(viewportY - buttonCenterY, 2)
      );

      debugText += `${buttons[index].label}: ${distance.toFixed(0)}px `;

      const tolerance = 150 / zoomLevel;
      if (distance < tolerance && distance < minDistance) {
        minDistance = distance;
        foundButton = buttons[index];
      }
    });

    setDebugInfo(debugText);

    handleGazeTracking(foundButton);
  };

  const handleGazeTracking = (currentButton) => {
    const now = Date.now();

    if (currentButton) {
      if (lastGazedButtonRef.current === currentButton.id) {
        if (gazeStartTimeRef.current) {
          const elapsed = now - gazeStartTimeRef.current;
          const progress = Math.min(elapsed / GAZE_THRESHOLD, 1);
          setGazeProgress(progress);

          if (elapsed >= GAZE_THRESHOLD) {
            activateButton(currentButton.id);
            resetGazeTracking();
          }
        }
      } else {
        startGazeTracking(currentButton.id);
      }
    } else {
      resetGazeTracking();
    }
  };

  const startGazeTracking = (buttonId) => {
    lastGazedButtonRef.current = buttonId;
    gazeStartTimeRef.current = Date.now();
    setSelectedButton(buttonId);
    setGazeProgress(0);
  };

  const resetGazeTracking = () => {
    lastGazedButtonRef.current = null;
    gazeStartTimeRef.current = null;
    setSelectedButton(null);
    setGazeProgress(0);
  };

  const activateButton = async (buttonId) => {
    console.log(`Activated: ${buttonId}`);

    setActivatedButton(buttonId);
    setTimeout(() => setActivatedButton(null), 2000);

    // Vibrate only if gaze control is enabled (meaning user has interacted)
    if (gazeControlEnabled && navigator.vibrate) {
      navigator.vibrate(200);
    }

    if (currentEmotion) {
      console.log(`Button ${buttonId} activated with emotion: ${currentEmotion} (${(emotionConfidence * 100).toFixed(1)}%)`);
    }

    switch (buttonId) {
      case 'call-nurse':
        await handleNurseCall();
        break;
      case 'water':
        await handleWaterRequest();
        break;
      case 'food':
        await handleFoodRequest();
        break;
      case 'pain':
        await handlePainReport();
        break;
      case 'bathroom':
        await handleBathroomRequest();
        break;
      case 'tv':
        await handleTVControl();
        break;
      case 'scroll-up':
        handleScrollUp();
        break;
      case 'scroll-down':
        handleScrollDown();
        break;
      case 'section1-action':
        await handleSection1Action();
        break;
      case 'section2-action':
        await handleSection2Action();
        break;
      default:
        break;
    }
  };

  const showNotification = (message, type) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };

    setNotifications((prev) => [...prev, notification]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  const handleNurseCall = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      showNotification('✅ Nurse has been notified!', 'success');
    } catch (error) {
      showNotification('❌ Failed to contact nurse', 'error');
    }
  };

  const handleWaterRequest = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      showNotification('💧 Water request sent to staff!', 'success');
    } catch (error) {
      showNotification('❌ Failed to send water request', 'error');
    }
  };

  const handleFoodRequest = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      showNotification('🍽️ Food request sent to kitchen!', 'success');
    } catch (error) {
      showNotification('❌ Failed to send food request', 'error');
    }
  };

  const handlePainReport = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const emotionContext = currentEmotion ? ` (detected emotion: ${currentEmotion})` : '';
      showNotification(`😣 Pain reported to medical staff!${emotionContext}`, 'success');
    } catch (error) {
      showNotification('❌ Failed to report pain', 'error');
    }
  };

  const handleBathroomRequest = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      showNotification('🚽 Bathroom assistance requested!', 'success');
    } catch (error) {
      showNotification('❌ Failed to request assistance', 'error');
    }
  };

  const handleTVControl = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      showNotification('📺 TV controls activated!', 'success');
    } catch (error) {
      showNotification('❌ Failed to control TV', 'error');
    }
  };

  const handleScrollUp = () => {
    window.scrollBy({
      top: -100,
      behavior: 'smooth',
    });
    showNotification('⬆️ Scrolled Up!', 'success');
  };

  const handleScrollDown = () => {
    window.scrollBy({
      top: 100,
      behavior: 'smooth',
    });
    showNotification('⬇️ Scrolled Down!', 'success');
  };

  const handleSection1Action = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      showNotification('🔧 Section 1 action triggered!', 'success');
    } catch (error) {
      showNotification('❌ Failed to trigger Section 1 action', 'error');
    }
  };

  const handleSection2Action = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      showNotification('⚙️ Section 2 action triggered!', 'success');
    } catch (error) {
      showNotification('❌ Failed to trigger Section 2 action', 'error');
    }
  };

  const startCalibration = () => {
    if (!faceDetected) {
      showNotification('Please ensure your face is detected before starting calibration.', 'warning');
      return;
    }
    setIsCalibrating(true);
    setCurrentCalibrationPoint(0);
    setCalibrationPoints([]);
    setIsCalibrated(false);
    setMappingParams({ a_x: 1, b_x: 0, a_y: 1, b_y: 0 });
    showNotification(`Starting calibration. Please look at the dot for: ${CALIBRATION_POINTS[0].label}`, 'info');
  };

  const calibratePoint = () => {
    if (currentCalibrationPoint < CALIBRATION_POINTS.length) {
      const point = CALIBRATION_POINTS[currentCalibrationPoint];
      setCalibrationPoints((prev) => [...prev, { point, gaze: gazeDirection }]);
      setCurrentCalibrationPoint((prev) => prev + 1);

      if (currentCalibrationPoint + 1 >= CALIBRATION_POINTS.length) {
        finishCalibration();
      } else {
        showNotification(`Calibrating point ${currentCalibrationPoint + 1}/${CALIBRATION_POINTS.length}: ${CALIBRATION_POINTS[currentCalibrationPoint + 1].label}`, 'info');
      }
    }
  };

  const finishCalibration = () => {
    if (calibrationPoints.length < CALIBRATION_POINTS.length) { // Ensure all points were collected
      showNotification('❌ Not enough calibration points collected. Please try again.', 'error');
      setIsCalibrating(false);
      return;
    }

    const topLeft = calibrationPoints.find((p) => p.point.label === 'Top Left');
    const topRight = calibrationPoints.find((p) => p.point.label === 'Top Right');
    const bottomLeft = calibrationPoints.find((p) => p.point.label === 'Bottom Left');
    // const center = calibrationPoints.find((p) => p.point.label === 'Center'); // Not used in current linear mapping
    // const bottomRight = calibrationPoints.find((p) => p.point.label === 'Bottom Right'); // Not used in current linear mapping

    if (topLeft && topRight && bottomLeft) {
      const detected_x_left = topLeft.gaze.x;
      const detected_x_right = topRight.gaze.x;
      const detected_y_top = topLeft.gaze.y;
      const detected_y_bottom = bottomLeft.gaze.y;

      const screen_x_left = topLeft.point.x;
      const screen_x_right = topRight.point.x;
      const screen_y_top = topLeft.point.y;
      const screen_y_bottom = bottomLeft.point.y;

      // Avoid division by zero
      const delta_detected_x = detected_x_right - detected_x_left;
      const delta_detected_y = detected_y_bottom - detected_y_top;

      const a_x = (screen_x_right - screen_x_left) / (delta_detected_x === 0 ? 0.0001 : delta_detected_x);
      const b_x = screen_x_left - a_x * detected_x_left;
      const a_y = (screen_y_bottom - screen_y_top) / (delta_detected_y === 0 ? 0.0001 : delta_detected_y);
      const b_y = screen_y_top - a_y * detected_y_top;

      setMappingParams({ a_x, b_x, a_y, b_y });
      setIsCalibrated(true);
      console.log('Calibration complete:', { collectedPoints: calibrationPoints, finalMapping: { a_x, b_x, a_y, b_y } });
      showNotification('🎯 Calibration completed successfully!', 'success');
    } else {
      showNotification('❌ Calibration incomplete, some key points were missing. Please try again.', 'error');
    }
    setIsCalibrating(false);
  };

  const clearEmotionBuffer = () => {
    setEmotionBuffer([]);
    setLastEmotionUpdate(0);
    setIsEmotionProcessing(false);
  };
  const clearEmotionHistory = () => {
    setEmotionHistory([]);
    setEmotionStats({});
    setEmotionAlerts([]);
    clearEmotionBuffer();
    showNotification('Emotion history cleared.', 'info');
  };


  const getMostFrequentEmotion = () => {
    if (Object.keys(emotionStats).length === 0) return null;
    return Object.entries(emotionStats).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  };

  useEffect(() => {
    const updateCanvasSize = () => {
      if (overlayCanvasRef.current) {
        const zoomLevel = window.devicePixelRatio || 1;
        overlayCanvasRef.current.width = window.innerWidth * zoomLevel;
        overlayCanvasRef.current.height = window.innerHeight * zoomLevel;
      }
      if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
        }
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    const initialRedraw = setTimeout(updateCanvasSize, 100);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      clearTimeout(initialRedraw);
    };
  }, []); // Removed isLoaded from dependencies, as canvas sizing should be independent of model loading

  useEffect(() => {
    let intervalId;
    // Only start detection if models are loaded AND gaze control is enabled by user interaction
    if (isLoaded && videoRef.current && gazeControlEnabled) {
      console.log('Starting face detection interval...');
      intervalId = setInterval(detectFace, 100); // Run detection every 100ms
    } else {
      console.log('Face detection interval not started:', { isLoaded, videoReady: !!videoRef.current, gazeControlEnabled });
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('Face detection interval cleared.');
      }
    };
  }, [isLoaded, gazeControlEnabled]); // Re-run effect when modelsLoaded or gazeControlEnabled changes

  useEffect(() => {
    return () => {
      console.log('Cleaning up gaze tracking on unmount...');
      resetGazeTracking();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        console.log('Video stream stopped.');
      }
    };
  }, []);

  // Conditional rendering based on gazeControlEnabled
  if (!gazeControlEnabled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="text-center bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Eye Gaze Control</h1>
          <p className="text-lg text-gray-700 mb-6">
            Click "Start Gaze Control" to enable your camera and begin.
          </p>
          <button
            onClick={handleStartGazeControl}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-all duration-300 transform hover:scale-105 shadow-md"
          >
            Start Gaze Control
          </button>
          <p className="text-sm text-gray-500 mt-4">
            (Requires camera access and Face-API.js models. Ensure `public/models` directory is present for offline use.)
          </p>
           {/* Notifications at this stage as well */}
           <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg text-white text-lg font-semibold shadow-lg transform transition-all duration-300 animate-pulse ${
                  notification.type === 'success' ? 'bg-green-500' : (notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500')
                }`}
              >
                {notification.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Once gazeControlEnabled is true, render the main application UI
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Overlay Canvas for Persistent Gaze Dot */}
      <canvas
        ref={overlayCanvasRef}
        className="fixed top-0 left-0 w-full h-full pointer-events-none z-40"
        style={{ zIndex: 40 }}
      />

      {/* Emotion Alerts */}
      <div className="fixed top-4 left-4 z-50 space-y-2">
        {emotionAlerts.map((alert, index) => (
          <div
            key={alert.id || index}
            className="p-3 rounded-lg text-white text-sm font-semibold shadow-lg bg-red-500 animate-pulse"
          >
            ⚠️ {alert.message}
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg text-white text-lg font-semibold shadow-lg transform transition-all duration-300 animate-pulse ${
              notification.type === 'success' ? 'bg-green-500' : (notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500')
            }`}
          >
            {notification.message}
          </div>
        ))}
      </div>

      {/* Current Emotion Display */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Current Emotion</h3>
            {isEmotionProcessing && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>

          {currentEmotion ? (
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{EMOTION_ICONS[currentEmotion]}</span>
              <div>
                <div className="font-semibold capitalize" style={{ color: EMOTION_COLORS[currentEmotion] }}>
                  {currentEmotion}
                </div>
                <div className="text-sm text-gray-500">
                  {(emotionConfidence * 100).toFixed(1)}% confident
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              {isEmotionProcessing ? 'Processing...' : 'No stable emotion detected'}
            </div>
          )}

          <div className="mt-2">
            <div className="text-xs text-gray-500 mb-1">
              Buffer: {emotionBuffer.length}/{EMOTION_BUFFER_SIZE}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(emotionBuffer.length / EMOTION_BUFFER_SIZE) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-1">
            Next update in: {Math.max(0, ((EMOTION_DETECTION_DELAY - (Date.now() - lastEmotionUpdate)) / 1000)).toFixed(1)}s
          </div>

          <button
            onClick={() => setShowEmotionDetails(!showEmotionDetails)}
            className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          >
            {showEmotionDetails ? 'Hide' : 'Show'} Details
          </button>
        </div>
      </div>

      {/* Emotion Details Panel */}
      {showEmotionDetails && (
        <div className="fixed bottom-32 right-4 z-50 bg-white rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Emotion Analytics</h3>
            <button
              onClick={clearEmotionHistory}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-600">
              Most Frequent:{' '}
              {getMostFrequentEmotion() ? (
                <>
                  {EMOTION_ICONS[getMostFrequentEmotion()]} {getMostFrequentEmotion()}
                </>
              ) : (
                'None'
              )}
            </div>

            <div className="text-xs text-gray-600">
              Detection Delay: {EMOTION_DETECTION_DELAY / 1000}s
            </div>

            <div className="text-xs text-gray-600">
              Processing: {isEmotionProcessing ? 'Yes' : 'No'}
            </div>

            <div className="text-xs text-gray-600">
              History: {emotionHistory.length}/{EMOTION_HISTORY_LIMIT}
            </div>

            <div className="text-xs space-y-1">
              <div className="font-semibold">Emotion Count:</div>
              {Object.entries(emotionStats).map(([emotion, count]) => (
                <div key={emotion} className="flex justify-between">
                  <span className="capitalize">
                    {EMOTION_ICONS[emotion]} {emotion}
                  </span>
                  <span>{count}</span>
                </div>
              ))}
            </div>

            {emotionBuffer.length > 0 && (
              <div className="text-xs space-y-1 border-t pt-2">
                <div className="font-semibold">Current Buffer:</div>
                {(() => {
                  const bufferCounts = {};
                  emotionBuffer.forEach(({ emotion }) => {
                    bufferCounts[emotion] = (bufferCounts[emotion] || 0) + 1;
                  });
                  return Object.entries(bufferCounts).map(([emotion, count]) => (
                    <div key={emotion} className="flex justify-between text-xs">
                      <span>{EMOTION_ICONS[emotion]} {emotion}</span>
                      <span>{count}/{emotionBuffer.length}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}


      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          Eye Gaze Control Interface
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video and Canvas Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Camera Feed</h2>
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-lg"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-64 pointer-events-none"
                width={640}
                height={480}
              />
            </div>

            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={startCalibration}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                disabled={!faceDetected} // Disable calibration if no face is detected
              >
                Calibrate
              </button>
              {isCalibrating && (
                <button
                  onClick={calibratePoint}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors ml-2"
                >
                  {currentCalibrationPoint < CALIBRATION_POINTS.length
                    ? `Calibrate Point ${currentCalibrationPoint + 1}`
                    : 'Finish Calibration'}
                </button>
              )}
              <div className="text-sm text-gray-600 ml-auto text-right">
                Gaze: ({gazeDirection.x.toFixed(2)}, {gazeDirection.y.toFixed(2)})
                <br />
                Mapping: (a_x: {mappingParams.a_x.toFixed(2)}, b_x: {mappingParams.b_x.toFixed(2)},
                a_y: {mappingParams.a_y.toFixed(2)}, b_y: {mappingParams.b_y.toFixed(2)})
                <br />
                <span className={faceDetected ? 'text-green-600' : 'text-red-600'}>
                  Face Detected: {faceDetected ? 'Yes' : 'No'}
                </span>
                <br />
                <span className={isCalibrated ? 'text-green-600' : 'text-red-600'}>
                  Calibrated: {isCalibrated ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            {isCalibrating && currentCalibrationPoint < CALIBRATION_POINTS.length && (
              <div className="text-center mt-2 text-blue-700 font-semibold text-lg">
                Look at the dot for: {CALIBRATION_POINTS[currentCalibrationPoint].label}
              </div>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Debug: {debugInfo}
            </p>
          </div>

          {/* Control Buttons */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            <div className="grid grid-cols-2 gap-4">
              {buttons.slice(0, 6).map((button) => (
                <button
                  key={button.id}
                  className={`gaze-button relative p-6 rounded-lg text-white font-semibold transition-all duration-200 ${
                    button.color
                  } ${
                    selectedButton === button.id ? 'ring-4 ring-yellow-400 scale-105' : 'hover:scale-105'
                  } ${
                    activatedButton === button.id ? 'ring-4 ring-green-400 bg-green-500' : ''
                  }`}
                  onClick={() => activateButton(button.id)}
                >
                  {button.icon} {button.label}
                  {selectedButton === button.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="absolute bg-white opacity-50 rounded-full"
                        style={{
                          width: `${gazeProgress * 100}%`,
                          height: `${gazeProgress * 100}%`,
                          transition: 'width 0.1s linear, height 0.1s linear',
                        }}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Additional Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                {buttons.slice(6).map((button) => (
                  <button
                    key={button.id}
                    className={`gaze-button relative p-6 rounded-lg text-white font-semibold transition-all duration-200 ${
                      button.color
                    } ${
                      selectedButton === button.id ? 'ring-4 ring-yellow-400 scale-105' : 'hover:scale-105'
                    } ${
                      activatedButton === button.id ? 'ring-4 ring-green-400 bg-green-500' : ''
                    }`}
                    onClick={() => activateButton(button.id)}
                  >
                    {button.icon} {button.label}
                    {selectedButton === button.id && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="absolute bg-white opacity-50 rounded-full"
                          style={{
                            width: `${gazeProgress * 100}%`,
                            height: `${gazeProgress * 100}%`,
                            transition: 'width 0.1s linear, height 0.1s linear',
                          }}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}