import React from "react";
import "./CardGrid.css";

const CardGrid = (params) => {
    const { children, variant = "default", className = "", onScroll } = params;
    const variantClass = `card-grid-${variant}`;
    const combinedClassName = className
        ? `cards ${variantClass} ${className}`
        : `cards ${variantClass}`;

    return (
        <div className={combinedClassName} onScroll={onScroll}>
            {children}
        </div>
    );
};

export default CardGrid;
