import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

interface NodeDoc {
    id: string;
    label?: string;
    content?: string;
    data?: {
        label?: string;
        content?: string;
    };
    hidden?: boolean;
}

interface EdgeDoc {
    source: string;
    target: string;
}

// Fetch map nodes/edges and return a markdown summary walking from roots depth-first.
export const buildMarkdownSummary = async (userId: string, mapId: string) => {
    const [nodeSnap, edgeSnap] = await Promise.all([
        getDocs(collection(db, "users", userId, "maps", mapId, "nodes")),
        getDocs(collection(db, "users", userId, "maps", mapId, "edges"))
    ]);

    const nodes = nodeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NodeDoc[];
    const edges = edgeSnap.docs.map(doc => doc.data() as EdgeDoc);

    const visibleNodes = nodes.filter(n => !n.hidden);
    if (visibleNodes.length === 0) return "";

    const nodeMap = new Map<string, NodeDoc>();
    visibleNodes.forEach(n => nodeMap.set(n.id, n));

    const childrenMap = new Map<string, string[]>();
    const incoming = new Set<string>();

    edges.forEach(({ source, target }) => {
        if (!nodeMap.has(source) || !nodeMap.has(target)) return;
        if (!childrenMap.has(source)) childrenMap.set(source, []);
        childrenMap.get(source)!.push(target);
        incoming.add(target);
    });

    const getLabel = (nodeId: string) => {
        const node = nodeMap.get(nodeId);
        return (node?.label || node?.data?.label || "제목 없음").toString();
    };

    childrenMap.forEach((childIds, parentId) => {
        childIds.sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
    });

    const roots = visibleNodes.filter(n => !incoming.has(n.id));
    const orderedRoots = roots.length > 0 ? roots : visibleNodes;

    const lines: string[] = [];
    const visited = new Set<string>();

    const pushContentLines = (content: string, depth: number) => {
        const indent = "  ".repeat(depth + 1);
        const normalized = content.replace(/\r\n?/g, "\n").split("\n");
        normalized.forEach(line => {
            lines.push(`${indent}> ${line || " "}`);
        });
    };

    const walk = (nodeId: string, depth: number) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = nodeMap.get(nodeId);
        if (!node) return;

        const label = getLabel(nodeId);
        const content = node.content || node?.data?.content;
        const indent = "  ".repeat(depth);
        lines.push(`${indent}- **${label}**`);
        if (content && content.trim().length > 0) {
            pushContentLines(content, depth);
        }

        (childrenMap.get(nodeId) || []).forEach(childId => walk(childId, depth + 1));
    };

    orderedRoots
        .sort((a, b) => getLabel(a.id).localeCompare(getLabel(b.id)))
        .forEach(root => walk(root.id, 0));

    visibleNodes.forEach(n => {
        if (!visited.has(n.id)) {
            walk(n.id, 0);
        }
    });

    return lines.join("\n");
};
