import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, setDoc, deleteDoc, writeBatch, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Node, Edge, Connection, addEdge, NodeChange, applyNodeChanges, EdgeChange, applyEdgeChanges } from "reactflow";

export const useMindMap = (mapId: string | null) => {
    const { user } = useAuth();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !mapId) {
            setNodes([]);
            setEdges([]);
            setLoading(false);
            return;
        }

        const nodesRef = collection(db, "users", user.uid, "maps", mapId, "nodes");
        const edgesRef = collection(db, "users", user.uid, "maps", mapId, "edges");

        // Clear previous state immediately to avoid showing stale data during loading
        setNodes([]);
        setEdges([]);

        const unsubscribeNodes = onSnapshot(nodesRef, (snapshot) => {
            const fetchedNodes = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    data: {
                        ...data.data,
                        content: data.content
                    }
                };
            }) as Node[];

            setNodes((prevNodes) => {
                // Merge fetched nodes with previous local state (specifically 'selected')
                return fetchedNodes.map(fetchedNode => {
                    const prevNode = prevNodes.find(n => n.id === fetchedNode.id);
                    return {
                        ...fetchedNode,
                        selected: prevNode ? prevNode.selected : false,
                        // potentially dragging or other local states could be preserved here
                    };
                });
            });
        });

        const unsubscribeEdges = onSnapshot(edgesRef, (snapshot) => {
            const fetchedEdges = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Edge[];
            setEdges(fetchedEdges);
        });

        setLoading(false);

        return () => {
            unsubscribeNodes();
            unsubscribeEdges();
        };
    }, [user, mapId]);

    const onNodesChange = (changes: NodeChange[]) => {
        setNodes((nds) => applyNodeChanges(changes, nds));
    };

    const onEdgesChange = (changes: EdgeChange[]) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    };

    const onConnect = (connection: Connection) => {
        setEdges((eds) => addEdge(connection, eds));
        if (user && mapId && connection.source && connection.target) {
            addDoc(collection(db, "users", user.uid, "maps", mapId, "edges"), {
                source: connection.source,
                target: connection.target,
                id: `e${connection.source}-${connection.target}`
            });
        }
    };

    const addNode = async (label: string, position: { x: number, y: number }) => {
        if (!user || !mapId) return null;
        try {
            const batch = writeBatch(db);
            const nodeDocRef = doc(collection(db, "users", user.uid, "maps", mapId, "nodes"));

            batch.set(nodeDocRef, {
                label,
                position,
                data: { label },
                type: 'diary',
                createdAt: serverTimestamp(),
            });

            const mapRef = doc(db, "users", user.uid, "maps", mapId);
            batch.update(mapRef, { updatedAt: serverTimestamp() });

            await batch.commit();
            return nodeDocRef.id;
        } catch (error) {
            console.error("Error adding node:", error);
            return null;
        }
    };

    const addNewEdge = async (source: string, target: string) => {
        if (!user || !mapId) return;
        const batch = writeBatch(db);
        const edgeRef = doc(collection(db, "users", user.uid, "maps", mapId, "edges"));

        batch.set(edgeRef, {
            source,
            target,
            id: `e${source}-${target}`
        });

        const mapRef = doc(db, "users", user.uid, "maps", mapId);
        batch.update(mapRef, { updatedAt: serverTimestamp() });

        await batch.commit();
    }

    const updateNodePosition = async (nodeId: string, position: { x: number, y: number }) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", nodeId);
        await updateDoc(nodeRef, { position });
    }

    const syncNode = async (node: Node) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", node.id);
        await setDoc(nodeRef, { ...node }, { merge: true });
    }

    const updateNodeContent = async (nodeId: string, label: string, content: string) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", nodeId);
        await updateDoc(nodeRef, {
            label,
            content,
            data: { label, preview: content.slice(0, 30) + (content.length > 30 ? "..." : "") }
        });

        // Also update the map's updatedAt timestamp
        const mapRef = doc(db, "users", user.uid, "maps", mapId);
        await updateDoc(mapRef, { updatedAt: serverTimestamp() });
    };

    const updateNodeVisibility = async (nodeId: string, hidden: boolean) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", nodeId);
        await updateDoc(nodeRef, { hidden });
    };

    const deleteNode = async (nodeId: string) => {
        if (!user || !mapId) return;

        try {
            const batch = writeBatch(db);
            const nodesToDelete = new Set<string>();
            const edgesToDelete = new Set<string>();

            // Helper to traverse graph and find descendants
            const findDescendants = (currentId: string) => {
                nodesToDelete.add(currentId);

                // Find outgoing edges from this node
                const outgoingEdges = edges.filter(edge => edge.source === currentId);

                outgoingEdges.forEach(edge => {
                    edgesToDelete.add(edge.id);
                    if (!nodesToDelete.has(edge.target)) {
                        findDescendants(edge.target);
                    }
                });
            };

            // Start traversal
            findDescendants(nodeId);

            // Also find incoming edges to any of the deleted nodes to maintain integrity
            // (e.g. if we delete a child, the edge from parent must go too)
            edges.forEach(edge => {
                if (nodesToDelete.has(edge.target) || nodesToDelete.has(edge.source)) {
                    edgesToDelete.add(edge.id);
                }
            });

            console.log(`Deleting ${nodesToDelete.size} nodes and ${edgesToDelete.size} edges recursively.`);

            // Add delete operations to batch
            nodesToDelete.forEach(id => {
                const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", id);
                batch.delete(nodeRef);
            });

            edgesToDelete.forEach(id => {
                const edgeRef = doc(db, "users", user.uid, "maps", mapId, "edges", id);
                batch.delete(edgeRef);
            });

            // Commit the batch
            await batch.commit();

            // Update map timestamp
            const mapRef = doc(db, "users", user.uid, "maps", mapId);
            await updateDoc(mapRef, { updatedAt: serverTimestamp() });

        } catch (error) {
            console.error("Error deleting node:", error);
            throw error;
        }
    };

    const addChildNodes = async (parentId: string, contents: string[]) => {
        if (!user || !mapId) return;

        const parentNode = nodes.find(n => n.id === parentId);
        if (!parentNode) return;

        try {
            const batch = writeBatch(db);
            const VERTICAL_GAP = 120;
            const HORIZONTAL_SLOT = 180;

            // 1. Find all existing siblings (children of this parent)
            const childEdges = edges.filter(e => e.source === parentId);
            const childIds = new Set(childEdges.map(e => e.target));
            const siblings = nodes.filter(n => childIds.has(n.id) && !n.hidden);

            // We will place multiple nodes. For each new node, we need to find a slot.
            // CAUTION: The 'siblings' array doesn't include the nodes we are *currently* adding in this loop.
            // We need to track the positions of newly added nodes to avoid overlap with each other.
            const newPositions: { x: number, y: number }[] = [];

            contents.forEach((content) => {
                const newNodeRef = doc(collection(db, "users", user.uid, "maps", mapId, "nodes"));
                const newEdgeRef = doc(collection(db, "users", user.uid, "maps", mapId, "edges"));

                // Find a free slot for this specific node
                // Merge existing siblings (with known positions) and previously placed new nodes
                const takenPositions = [
                    ...siblings.map(n => n.position),
                    ...newPositions
                ];

                let slotFound = false;
                let finalX = parentNode.position.x;

                // Check slots in order: 0, 1, -1, 2, -2...
                const checkIndices = [0];
                for (let i = 1; i < 50; i++) checkIndices.push(i, -i);

                for (const idx of checkIndices) {
                    const candidateX = parentNode.position.x + (idx * HORIZONTAL_SLOT);

                    // Check collision
                    const isOccupied = takenPositions.some(pos =>
                        Math.abs(pos.x - candidateX) < (HORIZONTAL_SLOT / 2)
                    );

                    if (!isOccupied) {
                        finalX = candidateX;
                        slotFound = true;
                        break;
                    }
                }

                // If massive overflow, just stack at the end
                if (!slotFound) {
                    finalX = parentNode.position.x + (takenPositions.length * HORIZONTAL_SLOT);
                }

                const position = { x: finalX, y: parentNode.position.y + VERTICAL_GAP };
                newPositions.push(position);

                batch.set(newNodeRef, {
                    label: content,
                    content: "", // Initialize body content as empty
                    position: position,
                    data: {
                        label: content,
                        preview: "" // Initialize preview as empty (don't repeat title)
                    },
                    type: 'diary',
                    createdAt: serverTimestamp(),
                });

                batch.set(newEdgeRef, {
                    source: parentId,
                    target: newNodeRef.id,
                    id: `e${parentId}-${newNodeRef.id}`
                });
            });

            const mapRef = doc(db, "users", user.uid, "maps", mapId);
            batch.update(mapRef, { updatedAt: serverTimestamp() });

            await batch.commit();
        } catch (error) {
            console.error("Error adding child nodes:", error);
            throw error;
        }
    };

    return {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode,
        addNewEdge,
        updateNodePosition,
        updateNodeContent,
        updateNodeVisibility,
        syncNode,
        setNodes,
        setEdges,
        deleteNode,
        addChildNodes
    };
};
