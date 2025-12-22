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

    // Sync with initialContent when mapId changes
    useEffect(() => {
        setContent(initialContent);
    }, [mapId, initialContent]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);

        // Auto-save logic (debounce)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            updateMapContent(mapId, val);
        }, 1000);
    };

    return (
        <div className={styles.container}>
            <textarea
                className={styles.editor}
                value={content}
                onChange={handleChange}
                placeholder="생각을 자유롭게 적어보세요..."
                autoFocus
            />
            {financials && financials.length > 0 && (
                <NoteFinancials financials={financials} />
            )}
        </div>
    );
}
