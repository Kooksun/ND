"use client";

import { useMaps, MapData } from "@/hooks/useMaps";
import { Plus, Map, Trash2, Edit2 } from "lucide-react";
import { useState } from "react";
import styles from "./Sidebar.module.css";

interface SidebarProps {
    currentMapId: string | null;
    onSelectMap: (mapId: string) => void;
    onNewMap: () => void;
}

export default function Sidebar({ currentMapId, onSelectMap, onNewMap }: SidebarProps) {
    const { maps, loading, deleteMap, updateMapTitle } = useMaps();
    const [editingMapId, setEditingMapId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);

    const handleEditStart = (map: MapData) => {
        setEditingMapId(map.id);
        setEditTitle(map.title);
    };

    const handleEditSave = async (mapId: string) => {
        if (editTitle.trim()) {
            await updateMapTitle(mapId, editTitle);
        }
        setEditingMapId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, mapId: string) => {
        if (e.key === 'Enter') {
            handleEditSave(mapId);
        } else if (e.key === 'Escape') {
            setEditingMapId(null);
        }
    };

    if (loading) return <div style={{ width: 250, padding: 20 }}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>내 다이어리</h2>
                <button
                    onClick={onNewMap}
                    className={styles.newButton}
                >
                    <Plus size={18} />
                    <span>새 페이지</span>
                </button>
            </div>

            <div className={styles.list}>
                <div className={styles.listContent}>
                    {maps.map((map) => (
                        <div
                            key={map.id}
                            className={`${styles.item} ${currentMapId === map.id ? styles.itemActive : ''}`}
                            onClick={() => onSelectMap(map.id)}
                            onMouseEnter={() => setHoveredMapId(map.id)}
                            onMouseLeave={() => setHoveredMapId(null)}
                        >
                            <div className={styles.itemLeft}>
                                <Map size={18} color={currentMapId === map.id ? "#0984e3" : "#b2bec3"} />
                                {editingMapId === map.id ? (
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onBlur={() => handleEditSave(map.id)}
                                        onKeyDown={(e) => handleKeyDown(e, map.id)}
                                        className={styles.input}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className={styles.mapTitle}>{map.title}</span>
                                )}
                            </div>

                            {(hoveredMapId === map.id || currentMapId === map.id) && (
                                <div className={styles.actions}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditStart(map);
                                        }}
                                        className={styles.actionButton}
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteMap(map.id);
                                        }}
                                        className={styles.actionButton}
                                        style={{ color: '#d63031' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
