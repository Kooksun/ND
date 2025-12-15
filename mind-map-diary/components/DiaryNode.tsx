import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus } from 'lucide-react';
import styles from './DiaryNode.module.css';

const DiaryNode = ({ data, isConnectable }: NodeProps) => {
    return (
        <div className={styles.diaryNode}>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} />

            <div className={styles.content}>
                <div className={styles.header}>
                    {data.label}
                </div>
                {data.preview && <div className={styles.preview}>{data.preview}</div>}

                <button
                    className={styles.addBtn}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent node selection
                        data.onAddChild && data.onAddChild();
                    }}
                    title="자식 노드 추가"
                >
                    <Plus size={14} />
                </button>
            </div>

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
        </div>
    );
};

export default memo(DiaryNode);
