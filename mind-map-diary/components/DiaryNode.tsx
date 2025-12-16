import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Trash2, Check } from 'lucide-react';
import styles from './DiaryNode.module.css';

const DiaryNode = ({ data, isConnectable, selected, id }: NodeProps) => {
    const [title, setTitle] = useState(data.label || "");
    const [content, setContent] = useState(data.data?.content || data.content || "");
    const [isEditing, setIsEditing] = useState(false);
    const [editStartWidth, setEditStartWidth] = useState<number | null>(null);
    const hasConnections = !!data.hasConnections;

    useEffect(() => {
        setTitle(data.label || "");
        setContent(data.data?.content || data.content || "");
    }, [data.label, data.data, data.content]);

    // Reset editing state when node is deselected
    useEffect(() => {
        if (!selected) {
            setIsEditing(false);
            setEditStartWidth(null);
        }
    }, [selected]);

    const handleSave = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.onUpdateContent) {
            await data.onUpdateContent(id, title, content);
        }
        setIsEditing(false); // Optionally exit edit mode on save
    }, [data, id, title, content]);

    const handleDelete = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("삭제하시겠습니까?")) {
            if (data.onDelete) {
                await data.onDelete(id);
            }
        }
    }, [data, id]);

    const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (isEditing) return;
        setEditStartWidth(e.currentTarget.offsetWidth);
        setIsEditing(true);
    }, [isEditing]);

    const TARGET_WIDTH = 320;
    const editStyle = (isEditing && editStartWidth) ? {
        width: `${TARGET_WIDTH}px`,
        minWidth: `${TARGET_WIDTH}px`,
        maxWidth: 'none',
        marginLeft: `-${(TARGET_WIDTH - editStartWidth) / 2}px`
    } : undefined;

    const handleStyle = hasConnections ? undefined : { visibility: 'hidden', pointerEvents: 'none' };

    return (
        <div
            className={`${styles.diaryNode} ${isEditing ? styles.editing : ''} ${selected ? styles.selected : ''}`}
            style={editStyle}
            onDoubleClick={handleDoubleClick}
        >
            <Handle
                id="target-top"
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                style={handleStyle}
            />
            <Handle
                id="target-left"
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                style={handleStyle}
            />
            <Handle
                id="target-right"
                type="target"
                position={Position.Right}
                isConnectable={isConnectable}
                style={handleStyle}
            />

            <div className={styles.content}>
                {isEditing ? (
                    <>
                        <input
                            className={`${styles.titleInput} nodrag`} // Prevents dragging the node when interacting with input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="제목"
                        />
                        <textarea
                            className={`${styles.contentInput} nodrag`}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="내용을 입력하세요..."
                        />
                        <div className={styles.actions}>
                            <button className={`${styles.btn} ${styles.deleteBtn}`} onClick={handleDelete} title="삭제">
                                <Trash2 size={14} /> 삭제
                            </button>
                            <button className={`${styles.btn} ${styles.saveBtn}`} onClick={handleSave} title="저장">
                                <Check size={14} /> 저장
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.header}>
                            {data.label}
                        </div>
                        {data.preview && <div className={styles.preview}>{data.preview}</div>}
                    </>
                )}

                {!isEditing && (
                    <button
                        className={styles.addBtn}
                        onClick={(e) => {
                            e.stopPropagation();
                            data.onAddChild && data.onAddChild();
                        }}
                        title="자식 노드 추가"
                    >
                        <Plus size={14} />
                    </button>
                )}
            </div>

            <Handle
                id="source-bottom"
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                style={handleStyle}
            />
            <Handle
                id="source-left"
                type="source"
                position={Position.Left}
                isConnectable={isConnectable}
                style={handleStyle}
            />
            <Handle
                id="source-right"
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                style={handleStyle}
            />
        </div>
    );
};

export default memo(DiaryNode);
