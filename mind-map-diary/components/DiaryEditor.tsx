"use client";
import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import styles from "./DiaryEditor.module.css";
import { Node } from "reactflow";

interface DiaryEditorProps {
    node: Node | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (nodeId: string, title: string, content: string) => Promise<void>;
}

export default function DiaryEditor({ node, isOpen, onClose, onSave }: DiaryEditorProps) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (node) {
            setTitle(node.data.label || "");
            setContent(node.data.content || "");
        }
    }, [node]);

    const handleSave = async () => {
        if (!node) return;
        setSaving(true);
        await onSave(node.id, title, content);
        setSaving(false);
        onClose();
    };

    if (!isOpen || !node) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <input
                        className={styles.titleInput}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="제목을 입력하세요..."
                    />
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.body}>
                    <textarea
                        className={styles.contentInput}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="오늘의 생각을 기록해보세요..."
                    />
                </div>

                <div className={styles.footer}>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                        <Save size={18} style={{ marginRight: 8 }} />
                        {saving ? "저장 중..." : "저장하기"}
                    </button>
                </div>
            </div>
        </div>
    );
}
