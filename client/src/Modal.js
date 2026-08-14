import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

const Modal = (params) => {
    const {
        isOpen,
        onClose,
        title,
        icon,
        size = "medium",
        showClose = true,
        closeOnBackdrop = true,
        closeOnEscape = true,
        footer,
        className = "",
        children,
        width,
    } = params;

    const modalRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (closeOnEscape && e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key === "Tab") {
                const focusables = modalRef.current?.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusables || focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                } else if (!e.shiftKey && document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, closeOnEscape, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        modalRef.current?.focus();
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="vv-modal-overlay"
            onClick={closeOnBackdrop ? onClose : undefined}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                className={`vv-modal vv-modal-${size} ${className}`}
                style={width ? { maxWidth: width } : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                {icon ? <span className="vv-modal-icon">{icon}</span> : null}
                {title || showClose ? (
                    <div className="vv-modal-header">
                        {title ? <h2 className="vv-modal-title">{title}</h2> : null}
                        {showClose ? (
                            <button
                                type="button"
                                className="vv-modal-close"
                                onClick={onClose}
                                aria-label="Close"
                            >
                                <span>×</span>
                            </button>
                        ) : null}
                    </div>
                ) : null}
                <div className="vv-modal-body">{children}</div>
                {footer ? (
                    <div className="vv-modal-footer">{footer}</div>
                ) : null}
            </div>
        </div>,
        document.body
    );
};

export default Modal;