// ============================================================
// reportGenerator.js — PDF generation for CTR, STR, Risk Assessment
// Uses jsPDF + jspdf-autotable (frontend-only, no backend needed)
// ============================================================

import jsPDF from 'jspdf';
import 'jspdf-autotable';

// --- Configurable Institution Defaults ---
const DEFAULTS = {
  institutionName: 'GAFA Academy',
  institutionAddress: 'Global Anti-Financial Crime Academy',
  fiuRegistration: 'FIU-IND/XXXXX/2024',
  complianceOfficer: 'Compliance Officer',
  currency: '₹',
  currencyCode: 'INR',
  regulatoryRef: 'PMLA Section 12(1)(a)',
  ctrThreshold: 1000000, // ₹10,00,000
};

// Get institution settings (from localStorage or defaults)
function getSettings() {
  try {
    const stored = localStorage.getItem('gafa_report_settings');
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULTS;
}

export function saveSettings(settings) {
  localStorage.setItem('gafa_report_settings', JSON.stringify(settings));
}

export function getReportSettings() {
  return getSettings();
}

// --- Helpers ---
function formatCurrency(amount, settings) {
  const s = settings || getSettings();
  return `${s.currency}${Number(amount || 0).toLocaleString('en-IN')}`;
}

function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addHeader(doc, title, refNumber, settings) {
  const s = settings || getSettings();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Institution Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(s.institutionName, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(s.institutionAddress, pageWidth / 2, 26, { align: 'center' });
  doc.text(`FIU Registration: ${s.fiuRegistration}`, pageWidth / 2, 31, { align: 'center' });

  // Divider
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(15, 35, pageWidth - 15, 35);

  // Report Title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(title, pageWidth / 2, 43, { align: 'center' });

  // Ref Number + Date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Reference: ${refNumber}`, 15, 50);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 15, 50, { align: 'right' });

  doc.setDrawColor(220);
  doc.line(15, 53, pageWidth - 15, 53);

  return 58; // y position after header
}

function addFooter(doc, pageNum, totalPages, settings) {
  const s = settings || getSettings();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(200);
  doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`${s.institutionName} — Confidential`, 15, pageHeight - 14);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 14, { align: 'center' });
  doc.text(`Compliance Officer: ${s.complianceOfficer}`, pageWidth - 15, pageHeight - 14, { align: 'right' });
}

function generateRefNumber(type) {
  const date = new Date();
  const ts = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${type}-${ts}-${rand}`;
}

// ============================================================
// 1. CTR — Cash Transaction Report
// ============================================================
export function generateCTR(transactions, params = {}) {
  const settings = getSettings();
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const refNumber = generateRefNumber('CTR');

  let y = addHeader(doc, 'CASH TRANSACTION REPORT (CTR)', refNumber, settings);

  // Report Parameters
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Report Parameters', 15, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  const paramLines = [
    `Reporting Period: ${formatDate(params.startDate)} to ${formatDate(params.endDate)}`,
    `Threshold: ${formatCurrency(params.threshold || settings.ctrThreshold, settings)}`,
    `Transaction Type: ${params.transactionType || 'All Cash Transactions'}`,
    `Regulatory Reference: ${settings.regulatoryRef}`,
    `Total Qualifying Transactions: ${transactions.length}`,
    `Total Value: ${formatCurrency(transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0), settings)}`,
    `Unique Customers: ${new Set(transactions.map(t => t.customer_id)).size}`,
  ];
  paramLines.forEach(line => {
    doc.text(line, 15, y);
    y += 4;
  });
  y += 3;

  // Transaction Table
  const tableData = transactions.map((t, i) => [
    i + 1,
    t.customer_id || 'N/A',
    t.customer_name || t.name || 'N/A',
    t.account_number || 'N/A',
    formatDate(t.transaction_date || t.timestamp),
    formatCurrency(t.amount, settings),
    t.transaction_type || 'Cash',
    t.branch || 'N/A',
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Customer ID', 'Name', 'Account', 'Date', 'Amount', 'Type', 'Branch']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 105], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });

  // Disclaimer
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  const disclaimer = [
    `DISCLAIMER: This Cash Transaction Report is generated in compliance with ${settings.regulatoryRef} of the Prevention of Money Laundering Act, 2002.`,
    'All cash transactions at or above the prescribed threshold must be reported to the Financial Intelligence Unit — India (FIU-IND) within 15 days',
    'of the month following the month in which the transaction was conducted. This report is confidential and intended solely for regulatory compliance.',
    '',
    `Prepared by: ${settings.complianceOfficer} | Signature: _____________________ | Date: ${formatDate(new Date())}`,
  ];
  disclaimer.forEach((line, i) => {
    if (finalY + (i * 4) < doc.internal.pageSize.getHeight() - 25) {
      doc.text(line, 15, finalY + (i * 4));
    }
  });

  // Add page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, settings);
  }

  doc.save(`CTR_${refNumber}.pdf`);
  return { refNumber, rowCount: transactions.length };
}

// ============================================================
// 2. STR — Suspicious Transaction Report
// ============================================================
export function generateSTR(investigation, customer, transactions, sarData = {}) {
  const settings = getSettings();
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const refNumber = generateRefNumber('STR');
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, 'SUSPICIOUS TRANSACTION REPORT (STR)', refNumber, settings);

  // Section 1: Case Information
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('1. CASE INFORMATION', 15, y);
  y += 6;

  const caseInfo = [
    ['Case ID', investigation?.case_id || 'N/A'],
    ['Alert Type', investigation?.alert_type || 'N/A'],
    ['Status', investigation?.status || 'N/A'],
    ['Investigation Date', formatDate(investigation?.created_at)],
    ['Assigned Analyst', investigation?.assigned_to || 'N/A'],
  ];

  doc.autoTable({
    startY: y,
    body: caseInfo,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: [80, 80, 80] },
      1: { textColor: [0, 0, 0] },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Section 2: Customer Profile
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('2. SUBJECT PROFILE', 15, y);
  y += 6;

  const custInfo = [
    ['Customer ID', customer?.customer_id || 'N/A'],
    ['Full Name', customer?.name || 'N/A'],
    ['Date of Birth', formatDate(customer?.date_of_birth)],
    ['Occupation', customer?.occupation || 'N/A'],
    ['Annual Income', formatCurrency(customer?.income, settings)],
    ['Country', customer?.country || 'N/A'],
    ['PAN/Aadhaar', customer?.pan_aadhaar || 'N/A'],
    ['PEP Status', customer?.pep_flag ? 'YES — Politically Exposed Person' : 'No'],
    ['Risk Tier', customer?.risk_tier || 'N/A'],
    ['Account Number', customer?.account_number || 'N/A'],
  ];

  doc.autoTable({
    startY: y,
    body: custInfo,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: [80, 80, 80] },
      1: { textColor: [0, 0, 0] },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Section 3: Flagged Transactions
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('3. FLAGGED TRANSACTIONS', 15, y);
  y += 6;

  const flaggedTxns = (transactions || []).filter(t => t.flagged);
  const txnData = (flaggedTxns.length > 0 ? flaggedTxns : transactions || []).slice(0, 50).map((t, i) => [
    i + 1,
    formatDate(t.transaction_date || t.timestamp),
    formatCurrency(t.amount, settings),
    t.transaction_type || 'N/A',
    t.destination_id || 'N/A',
    t.rule_triggered || t.flag_reason || 'N/A',
  ]);

  doc.autoTable({
    startY: y,
    head: [['#', 'Date', 'Amount', 'Type', 'Counterparty', 'Rule Triggered']],
    body: txnData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [180, 40, 40], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 245, 245] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Check if we need a new page
  if (y > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    y = 20;
  }

  // Section 4: Analyst Observations
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('4. ANALYST OBSERVATIONS', 15, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);

  const observations = [
    { label: 'Description of Suspicious Activity', text: sarData.description || investigation?.investigation_notes || 'N/A' },
    { label: 'Supporting Evidence', text: sarData.evidence || 'N/A' },
    { label: 'Recommendation', text: sarData.recommendation || 'N/A' },
  ];

  observations.forEach(obs => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80);
    doc.text(`${obs.label}:`, 15, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(obs.text, pageWidth - 35);
    doc.text(lines, 15, y);
    y += lines.length * 4 + 4;
  });

  // Section 5: Decision & Signature
  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('5. DECLARATION', 15, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  const declaration = [
    'I hereby declare that the information provided in this Suspicious Transaction Report is true and correct to the best of',
    'my knowledge and belief. This report is filed in compliance with the Prevention of Money Laundering Act, 2002 and',
    `the rules and regulations issued by FIU-IND (Registration: ${settings.fiuRegistration}).`,
    '',
    '',
    `Analyst Name: ${investigation?.assigned_to || settings.complianceOfficer}`,
    '',
    'Signature: _____________________',
    '',
    `Date: ${formatDate(new Date())}`,
    '',
    `Reviewed by: ${settings.complianceOfficer}`,
    '',
    'Compliance Officer Signature: _____________________',
  ];
  declaration.forEach(line => {
    doc.text(line, 15, y);
    y += 4;
  });

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, settings);
  }

  doc.save(`STR_${refNumber}.pdf`);
  return { refNumber, rowCount: flaggedTxns.length || transactions?.length || 0 };
}

// ============================================================
// 3. Risk Assessment Report
// ============================================================
export function generateRiskAssessment(customers, params = {}) {
  const settings = getSettings();
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const refNumber = generateRefNumber('RISK');
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, 'CUSTOMER RISK ASSESSMENT REPORT', refNumber, settings);

  // Executive Summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('EXECUTIVE SUMMARY', 15, y);
  y += 6;

  const high = customers.filter(c => (c.risk_tier || '').toUpperCase() === 'HIGH');
  const medium = customers.filter(c => (c.risk_tier || '').toUpperCase() === 'MEDIUM');
  const low = customers.filter(c => !['HIGH', 'MEDIUM'].includes((c.risk_tier || '').toUpperCase()));

  const summaryData = [
    ['Total Customers Assessed', String(customers.length)],
    ['HIGH Risk Customers', `${high.length} (${customers.length > 0 ? Math.round(high.length / customers.length * 100) : 0}%)`],
    ['MEDIUM Risk Customers', `${medium.length} (${customers.length > 0 ? Math.round(medium.length / customers.length * 100) : 0}%)`],
    ['LOW Risk Customers', `${low.length} (${customers.length > 0 ? Math.round(low.length / customers.length * 100) : 0}%)`],
    ['Reporting Period', `${formatDate(params.startDate || new Date())} to ${formatDate(params.endDate || new Date())}`],
    ['Assessment Type', params.assessmentType || 'Comprehensive'],
  ];

  doc.autoTable({
    startY: y,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: [80, 80, 80] },
      1: { textColor: [0, 0, 0], fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // HIGH Risk — Detailed
  if (high.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 40, 40);
    doc.text('HIGH RISK CUSTOMERS — DETAILED REVIEW', 15, y);
    y += 6;

    const highData = high.map((c, i) => [
      i + 1,
      c.customer_id || 'N/A',
      c.name || 'N/A',
      c.country || 'N/A',
      c.pep_flag ? 'YES' : 'No',
      formatCurrency(c.income, settings),
      c.risk_tier || 'HIGH',
      c.account_number || 'N/A',
    ]);

    doc.autoTable({
      startY: y,
      head: [['#', 'Customer ID', 'Name', 'Country', 'PEP', 'Income', 'Risk', 'Account']],
      body: highData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [180, 40, 40], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 245, 245] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        5: { halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // MEDIUM Risk — Summary Table
  if (medium.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 140, 0);
    doc.text('MEDIUM RISK CUSTOMERS — SUMMARY', 15, y);
    y += 6;

    const medData = medium.map((c, i) => [
      i + 1,
      c.customer_id || 'N/A',
      c.name || 'N/A',
      c.country || 'N/A',
      c.pep_flag ? 'YES' : 'No',
      c.risk_tier || 'MEDIUM',
    ]);

    doc.autoTable({
      startY: y,
      head: [['#', 'Customer ID', 'Name', 'Country', 'PEP', 'Risk']],
      body: medData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [200, 140, 0], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 250, 240] },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' } },
      margin: { left: 15, right: 15 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // LOW Risk — Count only
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 139, 34);
  doc.text('LOW RISK CUSTOMERS', 15, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.text(`Total LOW risk customers: ${low.length}. These customers present minimal risk and require standard due diligence.`, 15, y);
  y += 12;

  // Compliance Recommendation
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('RECOMMENDED ACTIONS', 15, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  const recommendations = [
    `1. Conduct Enhanced Due Diligence (EDD) for all ${high.length} HIGH risk customers within 30 days.`,
    `2. Schedule periodic reviews for ${medium.length} MEDIUM risk customers (quarterly recommended).`,
    '3. Update customer risk profiles based on latest transaction monitoring results.',
    '4. File STRs for any customers where suspicious activity has been identified.',
    '5. Present this report to the Board AML/CFT Committee for review.',
  ];
  recommendations.forEach(line => {
    doc.text(line, 15, y);
    y += 5;
  });

  y += 8;
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text(`Report prepared by: ${settings.complianceOfficer}`, 15, y);
  doc.text(`Date: ${formatDate(new Date())}`, 15, y + 4);
  doc.text('Signature: _____________________', 15, y + 12);

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, settings);
  }

  doc.save(`RiskAssessment_${refNumber}.pdf`);
  return { refNumber, rowCount: customers.length };
}
