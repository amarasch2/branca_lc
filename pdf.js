// Generazione e condivisione del PDF per i genitori (usata da home e pagina Documenti).
function generatePDF(nome, paymentData, schedeData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const vdbRaw  = paymentData.vdb?.[nome] || {};
    const mensRaw = paymentData.mensili?.[nome] || {};
    const cellaMese = (raw) => MESI.map(m => { const v = parseFloat(raw[m]) || 0; return v > 0 ? eur(v) : ''; });
    const vdbPag  = cellaMese(vdbRaw);
    const mensPag = cellaMese(mensRaw);

    const rimVDB  = rimanenza(MAX_VDB, somma(vdbRaw));
    const rimMens = rimanenza(MAX_MENSILI, somma(mensRaw));

    const border = [0, 0, 0];
    const hdrBg  = [235, 235, 235];
    const white  = [255, 255, 255];

    doc.autoTable({
        startY: 15,
        body: [
            [
                { content: '', colSpan: 2, styles: { lineWidth: 0, fillColor: white } },
                { content: 'Acconti dati', colSpan: 6, styles: { halign: 'center', fontStyle: 'bold', fillColor: white, lineColor: border, lineWidth: 0.3 } },
                { content: '', styles: { lineWidth: 0, fillColor: white } }
            ],
            [
                { content: 'Nominativo Lupetto', styles: { fontStyle: 'bold', fillColor: hdrBg } },
                { content: 'Quota VDB', styles: { fontStyle: 'bold', fillColor: hdrBg } },
                ...MESI.map(m => ({ content: m, styles: { fontStyle: 'bold', fillColor: hdrBg, halign: 'right' } })),
                { content: 'Rimanenza', styles: { fontStyle: 'bold', fillColor: hdrBg, halign: 'right' } }
            ],
            [
                { content: nome, rowSpan: 3, styles: { valign: 'middle', fontStyle: 'bold' } },
                { content: eur(MAX_VDB), styles: { fontStyle: 'bold', halign: 'right' } },
                ...vdbPag.map(v => ({ content: v, styles: { halign: 'right' } })),
                { content: eur(rimVDB), styles: { fontStyle: 'bold', halign: 'right' } }
            ],
            [
                { content: 'Quota Cancelleria totale', styles: { fontStyle: 'bold', fillColor: hdrBg } },
                ...MESI.map(m => ({ content: m, styles: { fontStyle: 'bold', fillColor: hdrBg, halign: 'right' } })),
                { content: 'Rimanenza', styles: { fontStyle: 'bold', fillColor: hdrBg, halign: 'right' } }
            ],
            [
                { content: eur(MAX_MENSILI), styles: { fontStyle: 'bold', halign: 'right' } },
                ...mensPag.map(v => ({ content: v, styles: { halign: 'right' } })),
                { content: eur(rimMens), styles: { fontStyle: 'bold', halign: 'right' } }
            ]
        ],
        bodyStyles: { lineWidth: 0.3, lineColor: border, textColor: [0,0,0], fillColor: white, fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 36 } },
        theme: 'grid',
        margin: { left: 14, right: 14 }
    });

    const pageW = doc.internal.pageSize.getWidth();
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        body: [[
            { content: `Totale da versare entro il ${SCADENZA}`, styles: { fontStyle: 'bold' } },
            { content: eur(rimVDB + rimMens), styles: { fontStyle: 'bold', halign: 'right' } }
        ]],
        bodyStyles: { lineWidth: 0.3, lineColor: border, textColor: [0,0,0], fontSize: 10, cellPadding: 4 },
        columnStyles: { 0: { cellWidth: 88 }, 1: { cellWidth: 38 } },
        theme: 'grid',
        margin: { left: pageW - 14 - 126, right: 14 }
    });

    const flagValues = CAMPI.map(({ field }) => schedeData[nome]?.[field] ? 'SI' : 'NO');
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head: [CAMPI.map(f => ({ content: f.label, styles: { fontStyle: 'bold', halign: 'center', fillColor: hdrBg } }))],
        body: [flagValues.map(v => ({
            content: v,
            styles: { halign: 'center', fontStyle: 'bold', textColor: v === 'SI' ? [34, 139, 34] : [200, 50, 50] }
        }))],
        bodyStyles: { lineWidth: 0.3, lineColor: border, textColor: [0,0,0], fontSize: 10, cellPadding: 4 },
        headStyles: { lineWidth: 0.3, lineColor: border, textColor: [0,0,0], fontSize: 9 },
        theme: 'grid',
        margin: { left: 14, right: 14 }
    });

    return doc;
}

async function shareOrDownloadPDF(doc, nome) {
    const fileName = `pagamento_${nome.replace(/\s+/g, '_')}.pdf`;
    const pdfBlob  = doc.output('blob');
    const file     = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: `Pagamento ${nome}` });
            return;
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }

    const url = URL.createObjectURL(pdfBlob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
