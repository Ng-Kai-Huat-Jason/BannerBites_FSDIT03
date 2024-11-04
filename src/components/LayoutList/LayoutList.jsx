import React, { useState, useEffect } from "react";

const LayoutList = () => {
  const [layouts, setLayouts] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLayouts();
  }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("http://localhost:5000/api/layouts");
      if (!response.ok) {
        throw new Error("Failed to fetch layouts");
      }
      const data = await response.json();
      const uniqueLayouts = data.filter(
        (layout, index, self) =>
          index === self.findIndex((l) => l.layoutId === layout.layoutId),
      );
      setLayouts(uniqueLayouts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLayoutDetails = async (layoutId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `http://localhost:5000/api/layouts/${layoutId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch layout details");
      }
      const data = await response.json();
      setSelectedLayout(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const AdComponent = ({ type, content, styles }) => {
    let mediaUrl = content.mediaUrl || content.src;

    if (!mediaUrl && content.s3Bucket && content.s3Key) {
      const s3Region = content.s3Region || "ap-southeast-1";
      const encodeS3Key = (key) => {
        return key
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");
      };
      const encodedS3Key = encodeS3Key(content.s3Key);
      mediaUrl = `https://${content.s3Bucket}.s3.${s3Region}.amazonaws.com/${encodedS3Key}`;
    }

    return (
      <div
        className="h-full overflow-hidden rounded-lg shadow-sm"
        style={styles}
      >
        {type === "text" && (
          <div className="p-4">
            <h3 className="text-lg font-semibold">{content.title}</h3>
            <p className="text-gray-600">{content.description}</p>
          </div>
        )}
        {type === "image" && (
          <div>
            <img
              src={mediaUrl}
              alt={content.title}
              className="h-auto w-full object-cover"
            />
            <div className="p-4">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-gray-600">{content.description}</p>
            </div>
          </div>
        )}
        {type === "video" && (
          <div>
            <video controls className="w-full">
              <source src={mediaUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="p-4">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-gray-600">{content.description}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const AdViewer = ({ layout }) => {
    if (!layout) {
      return <div>No layout provided</div>;
    }

    const { rows, columns, gridItems } = layout;

    return (
      <div
        className="grid h-full w-full gap-4"
        style={{
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {gridItems.map((item) => {
          if (!item || item.hidden) return null;

          const { index, row, column, scheduledAds, rowSpan, colSpan } = item;

          let adToDisplay = null;

          if (scheduledAds?.length > 0) {
            const now = new Date();
            const currentTimeString = `${now
              .getHours()
              .toString()
              .padStart(2, "0")}:${now
              .getMinutes()
              .toString()
              .padStart(2, "0")}`;

            const availableAds = scheduledAds.filter(
              (scheduledAd) => scheduledAd.scheduledTime <= currentTimeString,
            );

            if (availableAds.length > 0) {
              adToDisplay = availableAds.reduce((latestAd, currentAd) =>
                currentAd.scheduledTime > latestAd.scheduledTime
                  ? currentAd
                  : latestAd,
              );
            } else {
              adToDisplay = scheduledAds.reduce((nextAd, currentAd) =>
                currentAd.scheduledTime < nextAd.scheduledTime
                  ? currentAd
                  : nextAd,
              );
            }
          }

          if (!adToDisplay) return null;

          const ad = adToDisplay.ad;
          const { type, content, styles } = ad;

          const gridRowStart = row + 1;
          const gridColumnStart = column + 1;
          const gridRowEnd = gridRowStart + (rowSpan || 1);
          const gridColumnEnd = gridColumnStart + (colSpan || 1);

          return (
            <div
              key={index}
              className="rounded-lg bg-white"
              style={{
                gridRow: `${gridRowStart} / ${gridRowEnd}`,
                gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
              }}
            >
              <AdComponent type={type} content={content} styles={styles} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container p-4">
      <div className="grid md:flex md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow md:w-[20vw]">
          <h2 className="mb-4 text-xl font-bold">Available Layouts</h2>
          {loading && !selectedLayout && (
            <div className="flex items-center justify-center p-4 text-gray-600">
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
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
              Error: {error}
            </div>
          )}
          <div className="space-y-2">
            {layouts.map((layout) => (
              <button
                key={layout.layoutId}
                className={`w-full rounded-lg px-4 py-2 text-left transition-colors ${
                  selectedLayout?.layoutId === layout.layoutId
                    ? "bg-blue-600 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => fetchLayoutDetails(layout.layoutId)}
              >
                {layout.name || `Layout ${layout.layoutId}`}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-[2vw] w-[78vw] rounded-lg border border-orange-500 bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Layout Preview</h2>
          {loading && selectedLayout && (
            <div className="flex items-center justify-center p-4 text-gray-600">
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
            </div>
          )}
          {selectedLayout && !loading && <AdViewer layout={selectedLayout} />}
          {!selectedLayout && !loading && (
            <div className="p-4 text-center text-gray-500">
              Select a layout to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayoutList;
