// src/components/LayoutList/LayoutList.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../Navbar";
import { Maximize2, Minimize2 } from "lucide-react";
import LayoutViewer from "../AdViewer/LayoutViewer";
import axios from "axios";
import webgazer from "webgazer";

// Import the additional components
import CalibrationComponent from "../AdAnalytics/CalibrationComponent";
import GazeTrackingComponent from "../AdAnalytics/GazeTrackingComponent";
import GazeVisualizer from "../AdAnalytics/GazeVisualizer";

// LayoutList is a component that displays a list of available layouts, nested within is the LayoutViewer component, which renders the layout of ads
const LayoutList = () => {
  const [layouts, setLayouts] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllLayouts, setShowAllLayouts] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovering] = useState(false);
  const previewRef = useRef(null);

  const MOBILE_DISPLAY_LIMIT = 3;
  const websocketRef = useRef(null);
  const pendingLayoutIdRef = useRef(null); // Helps debounce clicks and avoid multiple unnecessary WebSocket creations.
  const reconnectAttemptsRef = useRef(0); // Keeps track of reconnection attempts.

  // Tracking states
  const [isTracking, setIsTracking] = useState(false);
  const [retentionTime, setRetentionTime] = useState(0);
  const [isLookingAtAd, setIsLookingAtAd] = useState(false);
  const [gazedAdId, setGazedAdId] = useState(null); // Track which ad is being gazed at

  // Consent state
  const [hasConsent, setHasConsent] = useState(false);

  // Gaze data for visualization
  const [currentGazeData, setCurrentGazeData] = useState(null);

  // Calibration states
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationCompleted, setCalibrationCompleted] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  useEffect(() => {
    fetchLayouts();
    // Handle window resize and fullscreen change events
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();

    // Handle fullscreen change event
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    // Add event listeners
    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);

      // Cleanup WebSocket when component unmounts
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (window.webgazer) {
      window.webgazer
        .setGazeListener((data, elapsedTime) => {
          if (data == null) return;
          // Handle gaze data
          console.log(data);
        })
        .begin();
    }
    return () => {
      if (window.webgazer) {
        window.webgazer.end();
      }
    };
  }, []);

  // Function to toggle fullscreen mode
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await previewRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  // Function to fetch layouts
  const fetchLayouts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Using axios to fetch layouts
      const response = await axios.get("http://localhost:5000/api/layouts");

      // The data is already parsed as JSON, so you can use it directly
      setLayouts(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle layout selection
  const handleLayoutSelect = async (layoutId) => {
    if (pendingLayoutIdRef.current === layoutId) {
      // If this layout is already pending, ignore the repeated request.
      return;
    }
    pendingLayoutIdRef.current = layoutId;
    reconnectAttemptsRef.current = 0; // Reset reconnect attempts for new selection

    try {
      setLoading(true);
      setError(null);
      setSelectedLayout(null);

      // Close the previous WebSocket connection if one exists
      if (websocketRef.current) {
        websocketRef.current.onclose = null; // Remove any existing onclose handlers to avoid triggering reconnections
        websocketRef.current.close();
        websocketRef.current = null;
      }

      // Fetch the initial layout data using axios
      const response = await axios.get(`http://localhost:5000/api/layouts/${layoutId}`);
      const layoutData = response.data; // axios automatically parses JSON

      // Extract unique adIds from scheduledAds
      const adIdsSet = new Set();
      layoutData.gridItems.forEach((item) => {
        item.scheduledAds.forEach((scheduledAd) => {
          if (scheduledAd.adId) {
            adIdsSet.add(scheduledAd.adId);
          }
        });
      });
      const adIds = Array.from(adIdsSet);

      // Fetch ad details
      const adsResponse = await axios.post(`http://localhost:5000/api/ads/batchGet`, { adIds });
      const ads = adsResponse.data;

      // Map adId to ad details
      const adsMap = {};
      ads.forEach((ad) => {
        adsMap[ad.adId] = ad;
      });

      // Attach ad details to scheduledAds
      layoutData.gridItems = layoutData.gridItems.map((item) => {
        const updatedScheduledAds = item.scheduledAds.map((scheduledAd) => ({
          ...scheduledAd,
          ad: adsMap[scheduledAd.adId] || null,
        }));
        return { ...item, scheduledAds: updatedScheduledAds };
      });

      setSelectedLayout(layoutData);

      // Set up WebSocket connection for real-time updates
      establishWebSocketConnection(layoutId);
    } catch (err) {
      setError(err.response?.data?.message || err.message); // Detailed error message if available
    } finally {
      setLoading(false);
      pendingLayoutIdRef.current = null; // Allow new layout selection after handling is complete
    }
  };

  // Function to establish WebSocket connection
  const establishWebSocketConnection = (layoutId) => {
    websocketRef.current = new WebSocket("ws://localhost:5000");

    websocketRef.current.onopen = () => {
      websocketRef.current.send(JSON.stringify({ type: "subscribe", layoutId }));
    };
    // Handle incoming WebSocket messages
    websocketRef.current.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);

        if (
          (parsedData.type === "layoutUpdate" || parsedData.type === "layoutData") &&
          parsedData.data.layoutId === layoutId
        ) {
          setSelectedLayout(parsedData.data);
        }
      } catch (e) {
        console.error("[FRONTEND] Error parsing WebSocket message:", e);
      }
    };
    // Handle WebSocket close event
    websocketRef.current.onclose = (event) => {
      if (pendingLayoutIdRef.current === layoutId && reconnectAttemptsRef.current < 5) {
        reconnectAttemptsRef.current += 1;
        setTimeout(() => {
          establishWebSocketConnection(layoutId);
        }, 5000);
      }
    };
    // Handle WebSocket errors
    websocketRef.current.onerror = (error) => {
      console.error("[FRONTEND] WebSocket error:", error);
    };
  };

  const handleGazeAtAd = useCallback(
    ({ x, y }) => {
      const adElements = document.querySelectorAll(".ad-item");
      let gazedAtAdId = null;

      adElements.forEach((adElement) => {
        const rect = adElement.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          gazedAtAdId = adElement.getAttribute("data-ad-id");
        }
      });

      if (gazedAtAdId !== gazedAdId) {
        // Reset retention time if gazed ad changes
        setRetentionTime(0);
      }

      if (gazedAtAdId) {
        setIsLookingAtAd(true);
        setGazedAdId(gazedAtAdId);
      } else {
        setIsLookingAtAd(false);
        setGazedAdId(null);
      }

      setCurrentGazeData({ x, y }); // Update gaze data for visualizer
    },
    [gazedAdId]
  );

  useEffect(() => {
    let gazeListenerSet = false;

    if (isCalibrated && isTracking) {
      webgazer
        .setGazeListener((data, elapsedTime) => {
          if (data) {
            handleGazeAtAd(data);
          }
        })
        .begin();
      gazeListenerSet = true;
      console.log("[WebGazer] Gaze listener has been set.");
    }

    return () => {
      if (gazeListenerSet) {
        webgazer.clearGazeListener();
        console.log("[WebGazer] Gaze listener has been cleared.");
      }
    };
  }, [isCalibrated, isTracking, handleGazeAtAd]);

  const handleConsent = () => {
    setHasConsent(true);
    if (selectedLayout) {
      // Optionally, start calibration or other processes
    }
  };

  const handleDeclineConsent = () => {
    setHasConsent(false);
    setIsTracking(false);
    setRetentionTime(0);
    setIsLookingAtAd(false);
    setGazedAdId(null);
    setCurrentGazeData(null);
  };

  // Calibration Handlers
  const handleStartCalibration = () => {
    if (isTracking) {
      handleEndTracking();
    }
    setIsCalibrating(true);
    setCalibrationCompleted(false);
  };

  const handleCalibrationComplete = () => {
    setIsCalibrating(false);
    setCalibrationCompleted(true);
    setIsCalibrated(true); // Indicate that calibration is complete
    // Start gaze tracking after calibration
    setIsTracking(true);
  };

  const handleEndTracking = () => {
    console.log("[WebGazer] Tracking ended from handleEndTracking.");

    try {
      if (webgazer && webgazer.end) {
        webgazer.end();
        webgazer.clearGazeListener();
        console.log("[WebGazer] WebGazer ended and listeners cleared successfully.");
      }

      // Hide video feed and overlays if they are still showing
      const videoFeed = document.getElementById("webgazerVideoFeed");
      if (videoFeed) {
        videoFeed.style.display = "none";
      }
      const faceOverlay = document.getElementById("webgazerFaceOverlay");
      if (faceOverlay) {
        faceOverlay.style.display = "none";
      }
      const predictionPoints = document.getElementById("webgazerPredictionPoints");
      if (predictionPoints) {
        predictionPoints.style.display = "none";
      }

      // Reset state
      setIsTracking(false);
      setRetentionTime(0);
      setIsLookingAtAd(false);
      setGazedAdId(null);
      setCurrentGazeData(null);
      setIsCalibrated(false); // Reset calibration state if desired

      console.log("[WebGazer] All resources and states have been reset.");
    } catch (error) {
      console.error("[WebGazer] Error during tracking cleanup:", error);
    }
  };

  // Display only the first 3 layouts on mobile
  const visibleLayouts = isMobile && !showAllLayouts ? layouts.slice(0, MOBILE_DISPLAY_LIMIT) : layouts;
  // Check if there are more layouts to display
  const hasMoreLayouts = isMobile && layouts.length > MOBILE_DISPLAY_LIMIT;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3 },
    },
  };

  const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  };

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="min-h-screen dark:dark-bg"
      >
        <Navbar />
        <div className="container mx-auto w-full p-4 md:p-12">
          <div className="flex flex-col md:min-h-[600px] md:flex-row">
            {/* Sidebar: List of layouts */}
            <motion.div variants={fadeVariants} className="w-full md:w-[300px] md:flex-shrink-0">
              <div className="mb-6 rounded-lg p-6 shadow light-bg dark:dark-bg dark:secondary-text md:mb-0">
                <motion.h2 variants={itemVariants} className="mb-4 text-xl font-bold">
                  Available Layouts
                </motion.h2>

                {loading && !selectedLayout && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center p-4 neutral-text"
                  >
                    <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading layouts...
                  </motion.div>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 rounded-lg p-4 alert-bg alert2-text"
                    >
                      Error: {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div className="space-y-2" variants={containerVariants}>
                  {visibleLayouts.map((layout) => (
                    <motion.button
                      key={layout.layoutId}
                      variants={itemVariants}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full rounded-lg px-4 py-2 text-left transition-colors ${
                        selectedLayout?.layoutId === layout.layoutId
                          ? "secondary-bg secondary-text"
                          : "neutral-bg primary-text hover:neutralalt-bg"
                      }`}
                      onClick={() => handleLayoutSelect(layout.layoutId)}
                    >
                      {layout.name || `Layout ${layout.layoutId}`}
                    </motion.button>
                  ))}

                  {hasMoreLayouts && (
                    <motion.button
                      variants={itemVariants}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors neutral-bg neutral-text hover:neutral-bg"
                      onClick={() => setShowAllLayouts(!showAllLayouts)}
                    >
                      <span>{showAllLayouts ? "Show Less" : "Show More"}</span>
                    </motion.button>
                  )}
                </motion.div>
              </div>
            </motion.div>

            {/* Main layout preview with fullscreen toggle */}
            <motion.div variants={fadeVariants} className="flex-1 md:ml-8">
              <div className="relative flex h-[500px] flex-col rounded-xl bg-gray-800 p-4 md:h-full md:min-h-[600px]">
                <div className="relative flex h-full w-full flex-col overflow-hidden rounded-lg dark-bg">
                  <AnimatePresence>
                    {selectedLayout && !loading && (
                      <motion.button
                        initial={{ opacity: 0.3 }}
                        animate={{ opacity: isHovering || isFullscreen ? 1 : 0 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleFullscreen}
                        className="absolute right-6 top-6 z-10 rounded-full bg-gray-800/80 p-2 transition-opacity duration-200 secondary-text hover:bg-gray-700/80"
                        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="h-5 w-5" />
                        ) : (
                          <Maximize2 className="h-5 w-5" />
                        )}
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <div ref={previewRef} className="flex h-full w-full items-center justify-center bg-white">
                    <AnimatePresence mode="wait">
                      {loading && selectedLayout && (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center p-4 light-text"
                        >
                          <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Loading layout preview...
                        </motion.div>
                      )}

                      {selectedLayout && !loading && (
                        <motion.div
                          key="layout"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="h-full w-full overflow-hidden"
                        >
                          <LayoutViewer layout={selectedLayout} />
                        </motion.div>
                      )}

                      {!selectedLayout && !loading && (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex h-full items-center justify-center p-4 neutral-text"
                        >
                          Select a layout to preview
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Calibration and Tracking Controls */}
          <div className="mt-4 flex space-x-2">
            {!isCalibrating && !calibrationCompleted && (
              <button
                onClick={handleStartCalibration}
                className="rounded-lg bg-blue-500 px-4 py-2 text-white"
                disabled={isCalibrating || isTracking || !selectedLayout}
              >
                Start Calibration
              </button>
            )}
            {isTracking && (
              <button
                onClick={handleEndTracking}
                className="rounded-lg bg-red-500 px-4 py-2 text-white"
              >
                End Tracking
              </button>
            )}
          </div>

          {/* Viewer Analytics Section */}
          {selectedLayout && hasConsent && (
            <div className="mt-8 rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-bold">Viewer Analytics</h2>
              <p className="mb-2">
                <strong>Retention Time:</strong> {retentionTime} seconds
              </p>
              <p>
                <strong>Looking at Ad:</strong>{" "}
                {isLookingAtAd ? `Yes (Ad ID: ${gazedAdId})` : "No"}
              </p>
              {calibrationCompleted && (
                <div className="mt-4 rounded-lg bg-green-100 p-4">
                  <p className="text-green-700">
                    Calibration was successfully completed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Render CalibrationComponent */}
      {isCalibrating && <CalibrationComponent onCalibrationComplete={handleCalibrationComplete} />}

      {/* Render GazeTrackingComponent only when tracking is active */}
      {isTracking && selectedLayout && hasConsent && (
        <GazeTrackingComponent onGazeAtAd={handleGazeAtAd} isActive={isTracking} />
      )}

      {/* Render GazeVisualizer */}
      {currentGazeData && <GazeVisualizer gazeData={currentGazeData} />}
    </>
  );
};

export default LayoutList;
