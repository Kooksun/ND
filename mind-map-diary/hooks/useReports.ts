import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { generateReport } from "@/utils/gemini";
import { buildMarkdownSummary } from "@/lib/summarizeMap";
import { MapData } from "./useMaps";

export interface ReportData {
    id: string;
    type: 'weekly' | 'monthly';
    periodId: string;
    periodDisplay: string;
    chronological: string;
    thematic: string;
    summary: string;
    emotion: string;
    createdAt: any;
}

export const useReports = (maps: MapData[]) => {
    const { user } = useAuth();
    const [reports, setReports] = useState<ReportData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setReports([]);
            setLoading(false);
            return;
        }

        const reportsRef = collection(db, "users", user.uid, "reports");
        const q = query(reportsRef, orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ReportData[];
            setReports(fetched);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const toDate = (val: any): Date | null => {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val.toDate === 'function') return val.toDate();
        if (val.seconds) return new Date(val.seconds * 1000);
        return new Date(val);
    };

    const getWeekNumber = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return weekNo;
    };

    const triggerReportGeneration = useCallback(async (type: 'weekly' | 'monthly', periodId: string, periodDisplay: string, startTime: number, endTime: number) => {
        if (!user) return;

        // Filter maps in range
        const mapsInRange = maps.filter(m => {
            const t = toDate(m.createdAt || m.updatedAt)?.getTime() || 0;
            return t >= startTime && t <= endTime;
        });

        if (mapsInRange.length === 0) return;

        try {
            const summaries: string[] = [];
            for (const map of mapsInRange) {
                const md = await buildMarkdownSummary(user.uid, map.id);
                if (md) summaries.push(`# ${map.title}\n\n${md}`);
            }

            if (summaries.length === 0) return;

            const combinedMarkdown = summaries.join("\n\n---\n\n");
            const result = await generateReport(type, periodDisplay, combinedMarkdown);

            await addDoc(collection(db, "users", user.uid, "reports"), {
                ...result,
                type,
                periodId,
                periodDisplay,
                createdAt: serverTimestamp(),
            });

            console.log(`Successfully generated ${type} report: ${periodId}`);
        } catch (error) {
            console.error(`Failed to trigger ${type} report generation:`, error);
        }
    }, [user, maps]);

    const checkAndGenerateAutoReports = useCallback(async () => {
        if (!user || maps.length === 0 || loading) return;

        const now = new Date();

        // 1. Weekly Check (Last Week: Mon-Sun)
        const lastWeekDate = new Date(now);
        lastWeekDate.setDate(now.getDate() - 7);

        const monday = new Date(lastWeekDate);
        monday.setDate(lastWeekDate.getDate() - (lastWeekDate.getDay() || 7) + 1);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const weekNum = getWeekNumber(monday);
        const weeklyPeriodId = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        const weeklyPeriodDisplay = `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${Math.ceil(monday.getDate() / 7)}주차`;

        if (!reports.some(r => r.periodId === weeklyPeriodId)) {
            await triggerReportGeneration('weekly', weeklyPeriodId, weeklyPeriodDisplay, monday.getTime(), sunday.getTime());
        }

        // 2. Monthly Check (Last Month)
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthFirst = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1, 0, 0, 0, 0);
        const lastMonthLast = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthlyPeriodId = `${lastMonthFirst.getFullYear()}-M${String(lastMonthFirst.getMonth() + 1).padStart(2, '0')}`;
        const monthlyPeriodDisplay = `${lastMonthFirst.getFullYear()}년 ${lastMonthFirst.getMonth() + 1}월 리포트`;

        if (!reports.some(r => r.periodId === monthlyPeriodId)) {
            await triggerReportGeneration('monthly', monthlyPeriodId, monthlyPeriodDisplay, lastMonthFirst.getTime(), lastMonthLast.getTime());
        }

        // 3. Current Week Check (In-Progress, for testing/immediate feedback)
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - (now.getDay() || 7) + 1);
        thisMonday.setHours(0, 0, 0, 0);

        const thisWeekNum = getWeekNumber(thisMonday);
        const thisWeeklyPeriodId = `${thisMonday.getFullYear()}-W${String(thisWeekNum).padStart(2, '0')}-IP`;
        const thisWeeklyPeriodDisplay = `${thisMonday.getFullYear()}년 ${thisMonday.getMonth() + 1}월 ${Math.ceil(thisMonday.getDate() / 7)}주차 (진행 중)`;

        if (!reports.some(r => r.periodId === thisWeeklyPeriodId)) {
            await triggerReportGeneration('weekly', thisWeeklyPeriodId, thisWeeklyPeriodDisplay, thisMonday.getTime(), now.getTime());
        }
    }, [user, maps, reports, loading, triggerReportGeneration]);

    useEffect(() => {
        if (!loading && user && reports.length >= 0 && maps.length > 0) {
            checkAndGenerateAutoReports();
        }
    }, [loading, user, reports.length, maps.length, checkAndGenerateAutoReports]);

    const deleteReport = useCallback(async (reportId: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, "users", user.uid, "reports", reportId));
        } catch (error) {
            console.error("Failed to delete report:", error);
        }
    }, [user]);

    return {
        reports,
        loadingReports: loading,
        deleteReport
    };
};
