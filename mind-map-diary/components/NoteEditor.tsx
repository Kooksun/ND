"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./NoteEditor.module.css";
import { useMaps } from "@/hooks/useMaps";
import NoteFinancials from "./NoteFinancials";

interface NoteEditorProps {
    mapId: string;
    initialContent: string;
    financials?: any[];
}

export default function NoteEditor({ mapId, initialContent, financials }: NoteEditorProps) {
    const [content, setContent] = useState(initialContent);
    const { updateMapContent } = useMaps();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Split content into left and right for desktop
    const parts = content.split("<!-- page-split -->");
    const leftContent = parts[0] || "";
    const rightContent = parts[1] || "";

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Sync with initialContent when mapId changes
    useEffect(() => {
        setContent(initialContent);
    }, [mapId, initialContent]);

    const handleContentChange = (newVal: string) => {
        setContent(newVal);

        // Auto-save logic (debounce)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            updateMapContent(mapId, newVal);
        }, 1000);
    };

    const handleLeftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const combined = `${val}<!-- page-split -->${rightContent}`;
        handleContentChange(combined);
    };

    const handleRightChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const combined = `${leftContent}<!-- page-split -->${val}`;
        handleContentChange(combined);
    };

    const handleMobileChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        handleContentChange(e.target.value);
    };

    return (
        <div className={styles.container}>
            <div className={styles.notebook}>
                {isMobile ? (
                    <div className={styles.page}>
                        <textarea
                            className={styles.editor}
                            value={content}
                            onChange={handleMobileChange}
                            placeholder="생각을 자유롭게 적어보세요..."
                            autoFocus
                        />
                    </div>
                ) : (
                    <>
                        <div className={`${styles.page} ${styles.leftPage}`}>
                            <textarea
                                className={styles.editor}
                                value={leftContent}
                                onChange={handleLeftChange}
                                placeholder="왼쪽 페이지에 적어보세요..."
                                autoFocus
                            />
                        </div>
                        <div className={`${styles.page} ${styles.rightPage}`}>
                            <textarea
                                className={styles.editor}
                                value={rightContent}
                                onChange={handleRightChange}
                                placeholder="오른쪽 페이지에 적어보세요..."
                            />
                        </div>
                    </>
                )}
            </div>
            {financials && financials.length > 0 && (
                <NoteFinancials financials={financials} />
            )}
        </div>
    );
}
