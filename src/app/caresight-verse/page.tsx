'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation'; // For redirection

// --- Supabase Configuration ---
// Replace with your actual Supabase URL and Anon Key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define emotion colors and icons for better visualization
const EMOTION_COLORS = {
  happy: '#22c55e',    // Green
  sad: '#3b82f6',      // Blue
  angry: '#ef4444',    // Red
  fearful: '#a855f7',  // Purple
  disgusted: '#eab308', // Yellow
  surprised: '#f97316', // Orange
  neutral: '#6b7280',  // Gray
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

// Define the duration an emotion must be stable for before triggering an alert (in milliseconds)
const STABLE_EMOTION_THRESHOLD_MS = 10000; // 10 seconds for alert
const EMOTION_BUFFER_SIZE = 15; // Number of frames to buffer (e.g., 15 frames at 100ms interval = 1.5 seconds)
const EMOTION_STABILITY_THRESHOLD = 0.6; // 60% of frames in buffer must have the same emotion

export default function EmotionDetector() {
  console.log('EmotionDetector component rendered.');
  const router = useRouter(); // Initialize Next.js router

  // Refs for video element and canvas for drawing detections
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State variables for UI feedback and detection results
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null); // Instantaneous emotion
  const [emotionConfidence, setEmotionConfidence] = useState<number>(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading face detection models...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- New States for Emotion Stability and Redirection ---
  const [emotionBuffer, setEmotionBuffer] = useState<{ emotion: string; confidence: number; timestamp: number }[]>([]);
  const [confirmedStableEmotion, setConfirmedStableEmotion] = useState<string | null>(null); // Emotion confirmed by buffer
  const [stableEmotionStartTime, setStableEmotionStartTime] = useState<number | null>(null);
  const [stableEmotionCountdown, setStableEmotionCountdown] = useState<number>(STABLE_EMOTION_THRESHOLD_MS / 1000);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // --- Model Loading ---
  const loadModels = useCallback(async () => {
    console.log('loadModels function called.');
    try {
      setLoadingMessage('Loading face detection models...');
      console.log('Attempting to load face-api.js models from CDN...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
        faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
      ]);
      setIsModelsLoaded(true);
      setLoadingMessage('Models loaded successfully.');
      console.log('Face-api.js models loaded successfully.');
    } catch (error) {
      console.error('Error loading models from CDN:', error);
      setLoadingMessage('Retrying with local models...');
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
        ]);
        setIsModelsLoaded(true);
        setLoadingMessage('Local models loaded successfully.');
        console.log('Face-api.js local models loaded successfully.');
      } catch (localError) {
        console.error('Error loading local models:', localError);
        setErrorMessage('Failed to load face detection models. Please check your network connection or ensure models are in public/models/.');
        setLoadingMessage('');
      }
    }
  }, []);

  // --- Camera Access ---
  const initCamera = useCallback(async () => {
    console.log('initCamera function called.');
    if (!videoRef.current) {
      console.warn("Video element not found during camera init. This might be a timing issue.");
      return;
    }
    if (isCameraReady || errorMessage) {
      console.log('Camera already ready or error present, skipping initCamera.');
      return;
    }

    try {
      setLoadingMessage('Requesting camera access...');
      console.log('Attempting to get user media (camera stream)...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      console.log('getUserMedia successful, stream obtained:', stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              console.log('Video stream started and playing.');
              resolve();
            };
          } else {
            resolve();
          }
        });
        setIsCameraReady(true);
        setLoadingMessage('Camera ready. Detecting emotions...');
        console.log('Camera is ready for detection.');
      }
      return stream; // Return the stream for cleanup in useEffect
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setIsCameraReady(false);
      if (error.name === 'NotAllowedError') {
        setErrorMessage('Camera access denied. Please grant permission in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No camera found. Please ensure a camera is connected and enabled.');
      } else if (error.name === 'NotReadableError') {
        setErrorMessage('Camera is in use or not readable. Please close other apps using the camera.');
      }
      else {
        setErrorMessage(`Failed to access camera: ${error.message}`);
      }
      setLoadingMessage('');
      return null; // Return null on error
    }
  }, [isCameraReady, errorMessage]);

  // --- Supabase Alert Creation ---
  const createAlertInSupabase = useCallback(async (emotion: string) => {
    console.log('createAlertInSupabase called for emotion:', emotion);
    if (isRedirecting) {
      console.log('Already redirecting, skipping alert creation.');
      return;
    }
    setIsRedirecting(true); // Set redirecting state immediately

    const patient_id = localStorage.getItem('user_id');
    console.log('Fetched patient_id from localStorage:', patient_id);

    if (!patient_id) {
      console.error('Patient ID not found in localStorage. Cannot create alert.');
      setErrorMessage('Patient ID not found. Cannot create alert.');
      setIsRedirecting(false); // Reset if patient_id is missing
      return;
    }

    try {
      // 1. Fetch assigned_nurse_ids and hospital_id from the patients table
      console.log('Fetching assigned_nurse_ids and hospital_id from patients table for patient_id:', patient_id);
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('assigned_nurse_ids, hospital_id') // Changed to assigned_nurse_ids
        .eq('id', patient_id)
        .single();

      if (patientError) {
        console.error('Error fetching patient data:', patientError);
        setErrorMessage(`Error fetching patient data: ${patientError.message}`);
        setIsRedirecting(false);
        return;
      }
      if (!patientData) {
        console.error('Patient data not found for ID:', patient_id);
        setErrorMessage('Patient data not found for alert creation.');
        setIsRedirecting(false);
        return;
      }

      const assigned_nurse_ids = patientData.assigned_nurse_ids;
      const hospital_id = patientData.hospital_id;
      console.log('Fetched assigned_nurse_ids:', assigned_nurse_ids, 'hospital_id:', hospital_id);

      // Select the first nurse_id from the array for the alert table
      const nurse_id = assigned_nurse_ids && assigned_nurse_ids.length > 0 ? assigned_nurse_ids[0] : null;

      if (!nurse_id || !hospital_id) {
        console.error('Missing nurse_id (from assigned_nurse_ids) or hospital_id for patient. Cannot create alert.');
        setErrorMessage('Missing nurse or hospital ID for alert creation.');
        setIsRedirecting(false);
        return;
      }

      // 2. Insert the alert into the alerts table
      console.log('Inserting alert into Supabase...');
      const { data, error: insertError } = await supabase
        .from('alert')
        .insert([
          {
            name: emotion,
            patient_id: patient_id,
            nurse_id: nurse_id, // Using the first assigned nurse
            hospital_id: hospital_id,
            status: 'new', // Assuming 'new' is a valid enum value for alert_status_enum
            seen: 'false', // Assuming 'false' is a valid enum value for alert_seen_enum
            // createdat and updatedat should be handled by Supabase defaults if configured
          },
        ])
        .select();

      if (insertError) {
        console.error('Error inserting alert:', insertError);
        setErrorMessage(`Error creating alert: ${insertError.message}`);
        setIsRedirecting(false);
        return;
      }

      console.log('Alert successfully created:', data);
      setLoadingMessage(`Alert for ${emotion} created! Redirecting...`);

      // 3. Redirect to a new page after successful alert creation
      setTimeout(() => {
        console.log('Redirecting to /dashboard');
        router.push('/dashboard'); // Redirect to your desired dashboard page
      }, 2000); // Give a moment for the user to see the message
    } catch (error: any) {
      console.error('Unexpected error during alert creation:', error);
      setErrorMessage(`An unexpected error occurred: ${error.message}`);
      setIsRedirecting(false);
    }
  }, [router, isRedirecting]);

  // --- Helper to analyze emotion stability from buffer ---
  const analyzeEmotionStability = useCallback((buffer: { emotion: string; confidence: number; timestamp: number }[]) => {
    if (buffer.length < EMOTION_BUFFER_SIZE) return null;

    const emotionCounts: { [key: string]: number } = {};
    buffer.forEach(({ emotion }) => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    const mostFrequentEmotion = Object.entries(emotionCounts)
      .reduce((prev, current) => (prev[1] > current[1] ? prev : current), ['', 0]);

    const [emotion, count] = mostFrequentEmotion;
    const stability = count / buffer.length;

    if (stability >= EMOTION_STABILITY_THRESHOLD) {
      return emotion;
    }
    return null;
  }, []);


  // --- Face and Emotion Detection Loop ---
  // Continuously detects faces and their emotions from the video stream.
  const detectEmotions = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isModelsLoaded || !isCameraReady || isRedirecting) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.videoWidth, height: video.videoHeight };

    faceapi.matchDimensions(canvas, displaySize);

    try {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (detections) {
          setFaceDetected(true);
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          faceapi.draw.drawDetections(canvas, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

          const expressions = resizedDetections.expressions;
          if (expressions) {
            const emotionEntries = Object.entries(expressions);
            const dominantEmotion = emotionEntries.reduce((prev, current) =>
              prev[1] > current[1] ? prev : current
            );
            const [emotion, confidence] = dominantEmotion;

            setCurrentEmotion(emotion); // Update instantaneous emotion for display
            setEmotionConfidence(confidence);

            // Add to emotion buffer for stability analysis
            setEmotionBuffer(prev => {
              const newBuffer = [...prev, { emotion, confidence, timestamp: Date.now() }];
              return newBuffer.slice(-EMOTION_BUFFER_SIZE); // Keep buffer size limited
            });

            // Analyze buffer for stable emotion
            const stableEmotion = analyzeEmotionStability(emotionBuffer);
            if (stableEmotion) {
              if (stableEmotion === confirmedStableEmotion) {
                // If the same stable emotion, continue the timer
                if (stableEmotionStartTime === null) {
                  setStableEmotionStartTime(Date.now());
                  console.log('Stable emotion timer started for:', stableEmotion);
                }
              } else {
                // New stable emotion confirmed by buffer, reset timer
                setConfirmedStableEmotion(stableEmotion);
                setStableEmotionStartTime(Date.now());
                setStableEmotionCountdown(STABLE_EMOTION_THRESHOLD_MS / 1000);
                console.log('New stable emotion confirmed by buffer:', stableEmotion, 'Timer reset.');
              }
            } else {
              // No stable emotion currently, reset tracking
              if (confirmedStableEmotion !== null) {
                console.log('No stable emotion detected, resetting tracking.');
              }
              setConfirmedStableEmotion(null);
              setStableEmotionStartTime(null);
              setStableEmotionCountdown(STABLE_EMOTION_THRESHOLD_MS / 1000);
            }

            // Draw emotion text on canvas
            const box = resizedDetections.detection.box;
            const emotionColor = EMOTION_COLORS[emotion as keyof typeof EMOTION_COLORS] || '#6b7280';
            context.fillStyle = emotionColor;
            context.fillRect(box.x, box.y - 30, box.width, 25);
            context.fillStyle = '#ffffff';
            context.font = '16px Arial';
            context.textAlign = 'center';
            context.fillText(
              `${EMOTION_ICONS[emotion as keyof typeof EMOTION_ICONS]} ${emotion} ${(confidence * 100).toFixed(0)}%`,
              box.x + box.width / 2,
              box.y - 10
            );
          }
        } else {
          setFaceDetected(false);
          setCurrentEmotion(null);
          setEmotionConfidence(0);
          // If no face, reset stable emotion tracking and buffer
          setEmotionBuffer([]);
          setConfirmedStableEmotion(null);
          setStableEmotionStartTime(null);
          setStableEmotionCountdown(STABLE_EMOTION_THRESHOLD_MS / 1000);
        }
      }
    } catch (detectionError) {
      console.error("Error during face detection:", detectionError);
    }
  }, [isModelsLoaded, isCameraReady, isRedirecting, emotionBuffer, confirmedStableEmotion, stableEmotionStartTime, analyzeEmotionStability]);

  // --- Effects ---

  // 1. Load models on component mount
  useEffect(() => {
    console.log('useEffect: Initial model loading triggered.');
    loadModels();
  }, [loadModels]);

  // 2. Start camera once models are loaded. This effect handles the camera stream lifecycle.
  useEffect(() => {
    console.log('useEffect: Camera lifecycle effect triggered. isModelsLoaded:', isModelsLoaded, 'isCameraReady:', isCameraReady, 'errorMessage:', errorMessage);
    let currentStream: MediaStream | null = null; // Local variable to hold the stream for cleanup

    if (isModelsLoaded && !isCameraReady && !errorMessage && !isRedirecting) {
      console.log('Condition met to call initCamera.');
      initCamera().then(stream => {
        if (stream) {
          currentStream = stream; // Store the stream for cleanup
        }
      });
    }

    // Cleanup function for camera stream: This runs when the component unmounts.
    return () => {
      console.log('Cleanup function for camera stream effect initiated.');
      if (currentStream) {
        console.log('Stream found in cleanup:', currentStream);
        currentStream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind}, ID: ${track.id}`);
          track.stop();
        });
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          console.log('videoRef.current.srcObject set to null during cleanup.');
        }
        setIsCameraReady(false);
        console.log('setIsCameraReady(false) during cleanup.');
      } else {
        console.log('No active camera stream to clean up in this effect instance.');
      }
    };
  }, [isModelsLoaded, errorMessage, isRedirecting, initCamera]); // Dependencies are now only what *triggers* the camera to start, not its state.

  // 3. Start emotion detection loop once camera is ready. This effect handles the detection interval.
  useEffect(() => {
    console.log('useEffect: Detection interval effect triggered. isModelsLoaded:', isModelsLoaded, 'isCameraReady:', isCameraReady, 'isRedirecting:', isRedirecting);
    let interval: NodeJS.Timeout | null = null;
    if (isModelsLoaded && isCameraReady && !isRedirecting) {
      console.log('Starting emotion detection interval.');
      interval = setInterval(detectEmotions, 100); // Run detection every 100ms
    } else {
      console.log('Stopping emotion detection interval (if active).');
      if (interval) {
        clearInterval(interval);
        console.log('Interval cleared.');
      }
    }

    // Cleanup function for detection interval: This runs when dependencies change or component unmounts.
    return () => {
      console.log('Cleanup function for detection interval initiated.');
      if (interval) {
        clearInterval(interval);
        console.log('Interval cleared during cleanup.');
      } else {
        console.log('No active detection interval to clean up.');
      }
    };
  }, [isModelsLoaded, isCameraReady, isRedirecting, detectEmotions]); // Dependencies for detection interval

  // 4. Effect for stable emotion countdown and alert triggering
  useEffect(() => {
    console.log('useEffect: Stable emotion countdown effect triggered. stableEmotionStartTime:', stableEmotionStartTime, 'confirmedStableEmotion:', confirmedStableEmotion, 'isRedirecting:', isRedirecting);
    let countdownInterval: NodeJS.Timeout | null = null;

    if (stableEmotionStartTime !== null && confirmedStableEmotion !== null && !isRedirecting) {
      countdownInterval = setInterval(() => {
        const elapsed = Date.now() - stableEmotionStartTime;
        const remaining = Math.max(0, STABLE_EMOTION_THRESHOLD_MS - elapsed);
        setStableEmotionCountdown(Math.ceil(remaining / 1000));
        console.log(`Countdown for ${confirmedStableEmotion}: ${Math.ceil(remaining / 1000)}s`);

        if (remaining <= 0) {
          clearInterval(countdownInterval!);
          console.log(`Stable emotion ${confirmedStableEmotion} detected for 10 seconds. Triggering alert.`);
          createAlertInSupabase(confirmedStableEmotion);
        }
      }, 1000); // Update countdown every second
    } else {
      // Reset countdown if no stable emotion or if redirecting
      setStableEmotionCountdown(STABLE_EMOTION_THRESHOLD_MS / 1000);
    }

    // Cleanup for countdown interval
    return () => {
      console.log('Cleanup function for stable emotion countdown effect initiated.');
      if (countdownInterval) {
        clearInterval(countdownInterval);
        console.log('Countdown interval cleared.');
      }
    };
  }, [stableEmotionStartTime, confirmedStableEmotion, isRedirecting, createAlertInSupabase]);


  // --- Render UI ---
  console.log('Rendering UI. isModelsLoaded:', isModelsLoaded, 'isCameraReady:', isCameraReady, 'errorMessage:', errorMessage, 'isRedirecting:', isRedirecting);
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-6">Emotion Detector</h1>

        {/* Main Content Area */}
        {/* The video and canvas elements are always rendered once models are loaded
            to ensure they are available when startCamera tries to access them. */}
        {isModelsLoaded ? (
          <>
            {/* Video Feed and Overlay Canvas */}
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-6">
              <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />
              {/* Overlay for loading/error messages or redirecting status */}
              {!isCameraReady || isRedirecting || errorMessage ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-white text-lg font-semibold rounded-lg">
                  {errorMessage ? (
                    <div className="text-red-500 text-center">
                      {errorMessage}
                    </div>
                  ) : isRedirecting ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-white mx-auto mb-3"></div>
                      Redirecting...
                    </div>
                  ) : (
                    <>
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-white mr-3"></div>
                      {loadingMessage}
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {/* Emotion Display */}
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                Current Emotion:
              </h2>
              {faceDetected && currentEmotion ? (
                <div className="flex items-center justify-center space-x-3">
                  <span className="text-5xl">{EMOTION_ICONS[currentEmotion as keyof typeof EMOTION_ICONS]}</span>
                  <div className="text-4xl font-extrabold capitalize" style={{ color: EMOTION_COLORS[currentEmotion as keyof typeof EMOTION_COLORS] }}>
                    {currentEmotion}
                  </div>
                  <div className="text-2xl text-gray-600">
                    ({(emotionConfidence * 100).toFixed(1)}%)
                  </div>
                </div>
              ) : (
                <p className="text-xl text-gray-500">
                  {faceDetected ? 'Analyzing emotion...' : 'No face detected'}
                </p>
              )}
              {/* Stable Emotion Countdown Display */}
              {confirmedStableEmotion && stableEmotionStartTime !== null && !isRedirecting && (
                <p className="text-lg text-blue-600 mt-2">
                  Stable {confirmedStableEmotion} detected for {stableEmotionCountdown}s.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            {errorMessage ? (
              <div className="text-red-600 text-lg font-semibold mb-4">
                {errorMessage}
              </div>
            ) : (
              <>
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mb-4"></div>
                <p className="text-lg text-gray-700">{loadingMessage}</p>
              </>
            )}
          </div>
        )}

        {/* Footer info */}
        <p className="text-sm text-gray-400 mt-8">
          Powered by <a href="https://github.com/justadudewhohacks/face-api.js" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">face-api.js</a>
        </p>
      </div>
    </div>
  );
}
