"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import styles from "./ModalLayer.module.css";

type Tone = "info" | "success" | "warning" | "danger" | "loading";

interface ModalLayerProps {
    open: boolean;
    title: string;
    message?: string;
    details?: string;
    tone?: Tone;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    inputValue?: string;
    onInputChange?: (value: string) => void;
    inputPlaceholder?: string;
    inputLabel?: string;
    allowDismiss?: boolean;
}

const toneMap: Record<Tone, { color: string; icon: ReactNode; badge: string; }> = {
    info: { color: "#0ea5e9", icon: <Info size={22} />, badge: "알림" },
    success: { color: "#22c55e", icon: <CheckCircle2 size={22} />, badge: "완료" },
    warning: { color: "#f59e0b", icon: <AlertTriangle size={22} />, badge: "확인" },
    danger: { color: "#ef4444", icon: <ShieldAlert size={22} />, badge: "주의" },
    loading: { color: "#636e72", icon: <div className={styles.spinner} />, badge: "진행 중" },
};

export default function ModalLayer({
    open,
    title,
    message,
    details,
    tone = "info",
    confirmText = "확인",
    cancelText = "닫기",
    showCancel = true,
    onConfirm,
    onCancel,
    inputLabel,
    inputPlaceholder,
    inputValue,
    onInputChange,
    allowDismiss = true,
}: ModalLayerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { color, icon, badge } = useMemo(() => toneMap[tone], [tone]);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select?.();
        }
    }, [open]);

    if (!open) return null;

    return (
        <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            onClick={() => allowDismiss && onCancel()}
        >
            <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
                <div className={styles.panelContent}>
                    <div className={styles.header}>
                        <span className={styles.icon} style={{ background: color }}>
                            {icon}
                        </span>
                        <div className={styles.titleGroup}>
                            <div className={styles.badgeRow}>
                                <span className={styles.badge}>{badge}</span>
                                <span className={styles.muted}>Mind Map Diary</span>
                            </div>
                            <div className={styles.title}>{title}</div>
                        </div>
                    </div>

                    {message && <p className={styles.message}>{message}</p>}
                    {details && (
                        <div className={styles.details} aria-live="polite">
                            {details}
                        </div>
                    )}

                    {onInputChange && (
                        <div className={styles.field}>
                            {inputLabel && <label className={styles.label}>{inputLabel}</label>}
                            <input
                                ref={inputRef}
                                className={styles.input}
                                placeholder={inputPlaceholder}
                                value={inputValue ?? ""}
                                onChange={(e) => onInputChange(e.target.value)}
                            />
                        </div>
                    )}

                    <div className={styles.actions}>
                        {showCancel && tone !== "loading" && (
                            <button className={`${styles.button} ${styles.secondary}`} onClick={onCancel}>
                                {cancelText}
                            </button>
                        )}
                        {tone !== "loading" && (
                            <button
                                className={`${styles.button} ${tone === "danger" ? styles.danger : styles.primary}`}
                                onClick={onConfirm}
                            >
                                {confirmText}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
