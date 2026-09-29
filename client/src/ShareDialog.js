import React, { useState } from "react";
import Modal from "./Modal";
import "./ShareDialog.css";

const ShareDialog = (params) => {
    const { isOpen, onClose, url, title, onCopied } = params;
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            if (onCopied) onCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.log("Error copying link:", error.message);
            if (onCopied) onCopied(false);
        }
    };

    const nativeShare = async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({ title: title || "VidVault video", url });
        } catch (error) {
            console.log("Native share dismissed:", error.message);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Share"
            size="small"
        >
            <div className="share-dialog">
                <div className="share-link-row">
                    <input
                        type="text"
                        readOnly
                        value={url}
                        onFocus={(e) => e.target.select()}
                        aria-label="Share link"
                    />
                    <button className="share-copy-btn" onClick={copy}>
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
                {navigator.share ? (
                    <button className="share-more-btn" onClick={nativeShare}>
                        More options
                    </button>
                ) : null}
            </div>
        </Modal>
    );
};

export default ShareDialog;
