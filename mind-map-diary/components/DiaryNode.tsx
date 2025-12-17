import { memo, useState, useEffect, useCallback, CSSProperties } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Trash2, Check, Wand2, Loader2 } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';
import { generateIdeas } from '@/utils/gemini';
import styles from './DiaryNode.module.css';

const DiaryNode = ({ data, isConnectable, selected, id }: NodeProps) => {
    const [title, setTitle] = useState(data.label || "");
    const [content, setContent] = useState(data.data?.content || data.content || "");
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editStartWidth, setEditStartWidth] = useState<number | null>(null);
    const modal = useModal();
    const connectedEdgeCount = data.connectedEdgeCount ?? (data.hasConnections ? 1 : 0);
    const hasConnections = connectedEdgeCount > 0;

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
        const confirmed = await modal.confirm({
            title: "노드를 삭제할까요?",
            message: "연결된 노트 흐름에도 영향이 있을 수 있어요.",
            confirmText: "삭제",
            cancelText: "유지하기",
            tone: "danger"
        });
        if (!confirmed) return;
        if (data.onDelete) {
            await data.onDelete(id);
        }
    }, [data, id, modal]);

    const handleBrainstorm = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGenerating) return;
        setIsGenerating(true);

        try {
            const topic = title.trim() || "새로운 생각";
            const ideas = await generateIdeas(topic);
            console.log("Brainstorm result:", ideas);

            // Note: Currently we are just printing to console as per user request to handle it "differently",
            // but the UI request implies they might want it to still generate nodes.
            // Re-enabling node generation for now as it's the only logical action for the button.
            if (data.onAddChildren) {
                await data.onAddChildren(ideas);
            }
        } catch (error) {
            console.error("Brainstorm failed:", error);
        } finally {
            setIsGenerating(false);
        }
    }, [title, isGenerating, data]);



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

    const handleStyle: CSSProperties | undefined = hasConnections
        ? undefined
        : { visibility: 'hidden', pointerEvents: 'none' };

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
            <Handle
                id="source-top"
                type="source"
                position={Position.Top}
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
                    <div className={styles.actionContainer}>
                        <button
                            className={`${styles.magicBtn} ${isGenerating ? styles.loading : ''} nodrag`}
                            onClick={handleBrainstorm}
                            title="AI 브레인스토밍 (자동 생성)"
                        >
                            {isGenerating ?
                                <Loader2 size={14} className={styles.spinAnimation} /> :
                                <Wand2 size={14} />
                            }
                        </button>
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
                    </div>
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
                id="target-bottom"
                type="target"
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
