import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import "./Toast.css";

export const ToastContext = createContext();

let nextId = 1;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        clearTimeout(timers.current[id]);
        delete timers.current[id];
    }, []);

    const showToast = useCallback((message, type = "success", duration = 3500) => {
        const id = nextId++;
        setToasts((prev) => [...prev, { id, message, type }]);
        timers.current[id] = setTimeout(() => removeToast(id), duration);
        return id;
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-stack">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.type}`}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext);
