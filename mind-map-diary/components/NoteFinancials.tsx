"use client";

import React from "react";
import styles from "./NoteFinancials.module.css";

interface FinancialItem {
    type: 'income' | 'expense';
    label: string;
    amount: number;
}

interface NoteFinancialsProps {
    financials: FinancialItem[];
}

export default function NoteFinancials({ financials }: NoteFinancialsProps) {
    if (!financials || financials.length === 0) return null;

    const totalIncome = financials
        .filter(f => f.type === 'income')
        .reduce((sum, f) => sum + f.amount, 0);

    const totalExpense = financials
        .filter(f => f.type === 'expense')
        .reduce((sum, f) => sum + f.amount, 0);

    const net = totalIncome - totalExpense;

    // Pie Chart Data Prep
    const expenseItems = financials.filter(f => f.type === 'expense');
    const pieData = expenseItems.map((item, idx) => {
        const percentage = totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0;
        return { ...item, percentage, color: getChartColor(idx) };
    });

    return (
        <div className={styles.container}>
            <div className={styles.tableContainer}>
                <h3 className={styles.title}>💰 수입 및 지출 분석</h3>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.th}>구분</th>
                            <th className={styles.th}>항목</th>
                            <th className={styles.th}>금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        {financials.map((item, i) => (
                            <tr key={i}>
                                <td className={`${styles.td} ${item.type === 'income' ? styles.income : styles.expense}`}>
                                    {item.type === 'income' ? '수입' : '지출'}
                                </td>
                                <td className={styles.td}>{item.label}</td>
                                <td className={styles.td}>{item.amount.toLocaleString()}원</td>
                            </tr>
                        ))}
                        <tr className={styles.subhead}>
                            <td className={styles.td} colSpan={2}>수입 소계</td>
                            <td className={`${styles.td} ${styles.income}`}>{totalIncome.toLocaleString()}원</td>
                        </tr>
                        <tr className={styles.subhead}>
                            <td className={styles.td} colSpan={2}>지출 소계</td>
                            <td className={`${styles.td} ${styles.expense}`}>{totalExpense.toLocaleString()}원</td>
                        </tr>
                        <tr className={styles.subhead} style={{ borderTop: '2px solid rgba(0,0,0,0.1)' }}>
                            <td className={styles.td} colSpan={2}>합계 (순수익)</td>
                            <td className={styles.td} style={{ fontWeight: 700 }}>{net.toLocaleString()}원</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {totalExpense > 0 && (
                <div className={styles.chartContainer}>
                    <div className={styles.chartTitle}>지출 통계</div>
                    <PieChart data={pieData} />
                    <div className={styles.legend}>
                        {pieData.map((item, idx) => (
                            <div key={idx} className={styles.legendItem}>
                                <span
                                    className={styles.legendColor}
                                    style={{ backgroundColor: item.color }}
                                />
                                <span className={styles.legendLabel}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PieChart({ data }: { data: any[] }) {
    let currentAngle = 0;

    return (
        <svg width="160" height="160" viewBox="0 0 32 32">
            {data.map((item, i) => {
                const sliceAngle = (item.percentage / 100) * 360;
                const largeArcFlag = sliceAngle > 180 ? 1 : 0;

                // Calculate start and end coordinates
                const x1 = 16 + 16 * Math.cos(Math.PI * currentAngle / 180);
                const y1 = 16 + 16 * Math.sin(Math.PI * currentAngle / 180);

                currentAngle += sliceAngle;

                const x2 = 16 + 16 * Math.cos(Math.PI * currentAngle / 180);
                const y2 = 16 + 16 * Math.sin(Math.PI * currentAngle / 180);

                return (
                    <path
                        key={i}
                        d={`M 16 16 L ${x1} ${y1} A 16 16 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                        fill={item.color}
                    >
                        <title>{`${item.label}: ${item.amount.toLocaleString()}원 (${item.percentage.toFixed(1)}%)`}</title>
                    </path>
                );
            })}
            <circle cx="16" cy="16" r="10" fill="var(--center-hole-color, white)" className="center-hole" style={{ opacity: 0.1 }} />
        </svg>
    );
}

function getChartColor(index: number) {
    const colors = [
        '#ff7675', '#fab1a0', '#ffeaa7',
        '#55efc4', '#81ecec', '#74b9ff',
        '#a29bfe', '#dfe6e9'
    ];
    return colors[index % colors.length];
}
