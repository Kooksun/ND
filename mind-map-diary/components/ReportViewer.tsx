"use client";

import React from "react";
import { ScrollText, LayoutGrid, Quote, Sparkles } from "lucide-react";
import styles from "./ReportViewer.module.css";
import { ReportData } from "@/hooks/useReports";

interface ReportViewerProps {
    report: ReportData;
}

export default function ReportViewer({ report }: ReportViewerProps) {
    // Markdown-like simple parsing for thematic content
    const formatContent = (text: string) => {
        // First split into blocks by double newlines for clear paragraph separation
        return text.split('\n\n').flatMap((block, i) => {
            const lines = block.split('\n');
            const elements = lines.map((line, j) => {
                const key = `${i}-${j}`;
                if (line.startsWith('###')) {
                    return <h3 key={key} className={styles.contentH3}>{line.replace(/###/g, '').trim()}</h3>;
                }
                if (line.startsWith('##')) {
                    return <h2 key={key} className={styles.contentH2}>{line.replace(/##/g, '').trim()}</h2>;
                }
                if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                    return <li key={key} className={styles.contentLi}>{line.trim().substring(1).trim()}</li>;
                }
                return line.trim() ? <p key={key} className={styles.contentP}>{line}</p> : null;
            }).filter(Boolean);

            // Add a small spacer between blocks if needed
            return elements;
        });
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <div className={styles.typeBadge}>
                        {report.type === 'weekly' ? 'WEEKLY REPORT' : 'MONTHLY REPORT'}
                    </div>
                    <h1 className={styles.title}>{report.periodDisplay}</h1>
                </div>
                <div className={styles.emotionSection}>
                    <span className={styles.emotion}>{report.emotion}</span>
                </div>
            </header>

            <div className={styles.summaryBox}>
                <p className={styles.summaryText}>{report.summary}</p>
            </div>

            <div className={styles.mainContent}>
                <section className={styles.column}>
                    <div className={styles.columnHeader}>
                        <ScrollText size={20} className={styles.columnIcon} />
                        <h2>시간순 분석</h2>
                    </div>
                    <div className={styles.columnBody}>
                        {formatContent(report.chronological)}
                    </div>
                </section>

                <div className={styles.divider} />

                <section className={styles.column}>
                    <div className={styles.columnHeader}>
                        <LayoutGrid size={20} className={styles.columnIcon} />
                        <h2>테마별 분석</h2>
                    </div>
                    <div className={styles.columnBody}>
                        {formatContent(report.thematic)}
                    </div>
                </section>
            </div>

            <footer className={styles.footer}>
                <Quote size={24} className={styles.quoteIcon} />
                <p>당신의 매일이 모여 빛나는 기록이 됩니다.</p>
            </footer>
        </div>
    );
}
