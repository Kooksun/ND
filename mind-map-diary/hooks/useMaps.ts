import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface MapData {
    id: string;
    title: string;
    createdAt: any;
    updatedAt: any;
}

export const useMaps = () => {
    const { user } = useAuth();
    const [maps, setMaps] = useState<MapData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setMaps([]);
            setLoading(false);
            return;
        }

        const mapsRef = collection(db, "users", user.uid, "maps");
        const q = query(mapsRef, orderBy("updatedAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMaps = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MapData[];
            setMaps(fetchedMaps);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const createMap = async (requestedTitle?: string) => {
        if (!user) return null;
        try {
            let title = requestedTitle;

            if (!title) {
                const now = new Date();
                const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일의 기록`;

                // Check for duplicates
                let candidateTitle = dateStr;
                let counter = 1;

                // Simple logic: if 'Title' exists, try 'Title #2', 'Title #3'...
                // Note: accurate check relies on 'maps' being up to date, which usually is due to snapshot
                while (maps.some(m => m.title === candidateTitle)) {
                    counter++;
                    candidateTitle = `${dateStr} #${counter}`;
                }
                title = candidateTitle;
            }

            const docRef = await addDoc(collection(db, "users", user.uid, "maps"), {
                title,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating map:", error);
            return null;
        }
    };

    const updateMapTitle = async (mapId: string, title: string) => {
        if (!user) return;
        const mapRef = doc(db, "users", user.uid, "maps", mapId);
        await updateDoc(mapRef, {
            title,
            updatedAt: serverTimestamp()
        });
    };

    const deleteMap = async (mapId: string) => {
        if (!user) return;
        if (confirm("정말로 이 지도를 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, "users", user.uid, "maps", mapId));
        }
    }

    return {
        maps,
        loading,
        createMap,
        updateMapTitle,
        deleteMap
    };
};
