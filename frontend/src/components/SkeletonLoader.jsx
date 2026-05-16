import React from "react";
import "../styles/MainContent/SkeletonLoader.css";

const SkeletonLoader = () => {
  return (
    <div className="playlist-loading">
        <div className="skeleton-header">
          <div className="skeleton-image shimmer"></div>
          <div className="skeleton-info">
            <div className="skeleton-line title shimmer"></div>
            <div className="skeleton-line subtitle shimmer"></div>
            <div className="skeleton-line description shimmer"></div>
          </div>
        </div>
        <div className="skeleton-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="skeleton-row shimmer" key={i}></div>
          ))}
        </div>
      </div>
  );
};

export default SkeletonLoader;