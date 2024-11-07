// src/components/AdViewer/AdViewer.jsx
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

// Component to represent an individual Ad
const AdComponent = ({ type, content, styles }) => {
  let mediaUrl = content.mediaUrl || content.src;

  if (!mediaUrl && content.s3Bucket && content.s3Key) {
    const s3Region = content.s3Region || "ap-southeast-1";
    const encodeS3Key = (key) =>
      key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    const encodedS3Key = encodeS3Key(content.s3Key);
    mediaUrl = `https://${content.s3Bucket}.s3.${s3Region}.amazonaws.com/${encodedS3Key}`;
  }

  return (
    <div className="ad-item" style={styles}>
      {type === "text" && (
        <div>
          <h3>{content.title}</h3>
          <p>{content.description}</p>
        </div>
      )}
      {type === "image" && (
        <div>
          <img src={mediaUrl} alt={content.title} style={{ maxWidth: "100%" }} />
          <h3>{content.title}</h3>
          <p>{content.description}</p>
        </div>
      )}
      {type === "video" && (
        <div>
          <video controls style={{ width: "100%" }}>
            <source src={mediaUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <h3>{content.title}</h3>
          <p>{content.description}</p>
        </div>
      )}
    </div>
  );
};

// Main AdViewer component to render the layout
// Main AdViewer component to render the layout
const AdViewer = ({ layoutId }) => {
  const [layout, setLayout] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const socketUrl = "http://localhost:5000"; // Socket.IO backend address

  useEffect(() => {
    // Initialize Socket.IO client
    const socket = io(socketUrl);

    socket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      socket.emit("getLayout", { layoutId });
    });

    // Handle receiving initial layout data
    socket.on("layoutData", (data) => {
      setLayout(data);
      console.log("Received initial layout data:", data);
    });

    // Handle real-time updates
    socket.on("layoutUpdate", (data) => {
      if (data.layoutId === layoutId) {
        setLayout(data);
        console.log("Updated layout data:", data);
      }
    });

    // Handle errors from server
    socket.on("error", (error) => {
      console.error("Socket.IO error:", error);
    });

    // Cleanup when component unmounts
    return () => {
      socket.disconnect();
      console.log("Disconnected from Socket.IO server");
    };
  }, [layoutId]);

  if (!layout) {
    return <div>Loading layout...</div>;
  }

  const { rows, columns, gridItems } = layout;

  return (
    <div
      className="ad-viewer-grid"
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: "10px",
        width: "100%",
        height: "100%",
      }}
    >
      {gridItems.map((item) => {
        if (!item || item.hidden) return null; // Skip null or hidden items

        const { index, row, column, scheduledAds, rowSpan, colSpan } = item;

        let adToDisplay = null;

        if (scheduledAds && scheduledAds.length > 0) {
          const currentTimeString = `${currentTime.getHours().toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}`; // Format as "HH:mm"

          const availableAds = scheduledAds.filter(
            (scheduledAd) => scheduledAd.scheduledTime <= currentTimeString
          );

          if (availableAds.length > 0) {
            adToDisplay = availableAds.reduce((latestAd, currentAd) =>
              currentAd.scheduledTime > latestAd.scheduledTime ? currentAd : latestAd
            );
          } else {
            adToDisplay = scheduledAds.reduce((nextAd, currentAd) =>
              currentAd.scheduledTime < nextAd.scheduledTime ? currentAd : nextAd
            );
          }
        }

        if (!adToDisplay) {
          return null; // No ad to display in this cell
        }

        const ad = adToDisplay.ad;
        const { type, content, styles } = ad;

        const gridRowStart = row + 1;
        const gridColumnStart = column + 1;
        const gridRowEnd = gridRowStart + (rowSpan || 1);
        const gridColumnEnd = gridColumnStart + (colSpan || 1);

        return (
          <div
            key={index}
            className="grid-cell"
            style={{
              gridRow: `${gridRowStart} / ${gridRowEnd}`,
              gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
              border: "1px solid #ccc",
              padding: "10px",
              backgroundColor: "#fafafa",
            }}
          >
            <AdComponent type={type} content={content} styles={styles} />
          </div>
        );
      })}
    </div>
  );
};

export default AdViewer;