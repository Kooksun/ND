import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Trash2, Check } from 'lucide-react';
import styles from './DiaryNode.module.css';

const DiaryNode = ({ data, isConnectable, selected, id }: NodeProps) => {
    const [title, setTitle] = useState(data.label || "");
    const [content, setContent] = useState(data.data?.content || data.content || "");

    useEffect(() => {
        setTitle(data.label || "");
        setContent(data.data?.content || data.content || "");
    }, [data.label, data.data, data.content]);

    const handleSave = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.onUpdateContent) {
            await data.onUpdateContent(id, title, content);
        }
    }, [data, id, title, content]);

    const handleDelete = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("삭제하시겠습니까?")) {
            if (data.onDelete) {
                await data.onDelete(id);
            }
        }
    }, [data, id]);

    return (
        <div className={`${styles.diaryNode} ${selected ? styles.selected : ''}`}>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} />

            <div className={styles.content}>
                {selected ? (
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

                {!selected && (
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

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
        </div>
    );
};

export default memo(DiaryNode);
