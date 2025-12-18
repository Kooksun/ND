"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ModalLayer from "@/components/ModalLayer";

type Tone = "info" | "success" | "warning" | "danger" | "loading";
type Mode = "alert" | "confirm" | "prompt";

interface ModalOptions {
    title: string;
    message?: string;
    details?: string;
    tone?: Tone;
    confirmText?: string;
    cancelText?: string;
    allowDismiss?: boolean;
    inputLabel?: string;
    inputPlaceholder?: string;
    initialValue?: string;
    showCancel?: boolean;
}

type ModalResult = boolean | string | null | void;

interface ModalContextType {
    alert: (options: ModalOptions) => Promise<void>;
    confirm: (options: ModalOptions) => Promise<boolean>;
    prompt: (options: ModalOptions) => Promise<string | null>;
    show: (options: ModalOptions & { mode?: Mode }) => Promise<ModalResult>;
}

interface ModalState extends ModalOptions {
    mode: Mode;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
    const ctx = useContext(ModalContext);
    if (!ctx) throw new Error("useModal must be used within ModalProvider");
    return ctx;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
    const [modal, setModal] = useState<ModalState | null>(null);
    const [resolver, setResolver] = useState<((value: ModalResult) => void) | null>(null);
    const [mounted, setMounted] = useState(false);
    const [inputValue, setInputValue] = useState("");

    useEffect(() => setMounted(true), []);

    const cleanup = useCallback((value: ModalResult) => {
        resolver?.(value);
        setModal(null);
        setResolver(null);
        setInputValue("");
    }, [resolver]);

    const openModal = useCallback((options: ModalState) => {
        return new Promise<ModalResult>((resolve) => {
            setModal(options);
            setResolver(() => resolve);
            setInputValue(options.initialValue ?? "");
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (!modal) return;
        if (modal.mode === "prompt") {
            cleanup(inputValue);
        } else {
            cleanup(true);
        }
    }, [cleanup, inputValue, modal]);

    const handleCancel = useCallback(() => {
        if (!modal) return;
        if (modal.mode === "prompt") {
            cleanup(null);
        } else {
            cleanup(false);
        }
    }, [cleanup, modal]);

    useEffect(() => {
        if (!modal) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && modal.allowDismiss !== false) {
                event.preventDefault();
                handleCancel();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modal, handleCancel]);

    useEffect(() => {
        if (modal) {
            const previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = previousOverflow;
            };
        }
    }, [modal]);

    const contextValue = useMemo<ModalContextType>(() => ({
        alert: async (options) => {
            await openModal({ ...options, mode: "alert", showCancel: options.showCancel ?? false });
            return;
        },
        confirm: async (options) => {
            const result = await openModal({ ...options, mode: "confirm", showCancel: options.showCancel ?? true });
            return result === true;
        },
        prompt: async (options) => {
            const result = await openModal({
                ...options,
                mode: "prompt",
                showCancel: options.showCancel ?? true,
            });
            return typeof result === "string" ? result : null;
        },
        show: async (options) => {
            return openModal({ ...options, mode: options.mode ?? "alert" });
        }
    }), [openModal]);

    return (
        <ModalContext.Provider value={contextValue}>
            {children}
            {mounted && modal && createPortal(
                <ModalLayer
                    open={!!modal}
                    title={modal.title}
                    message={modal.message}
                    details={modal.details}
                    tone={modal.tone}
                    confirmText={modal.confirmText}
                    cancelText={modal.cancelText}
                    showCancel={modal.showCancel}
                    allowDismiss={modal.allowDismiss}
                    inputLabel={modal.mode === "prompt" ? modal.inputLabel ?? "입력" : undefined}
                    inputPlaceholder={modal.mode === "prompt" ? modal.inputPlaceholder : undefined}
                    inputValue={modal.mode === "prompt" ? inputValue : undefined}
                    onInputChange={modal.mode === "prompt" ? setInputValue : undefined}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />,
                document.body
            )}
        </ModalContext.Provider>
    );
};
