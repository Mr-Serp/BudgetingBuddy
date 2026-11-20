const spreadsheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const officeRelNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRelNs = 'http://schemas.openxmlformats.org/package/2006/relationships';

function xmlText(value) {
  return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function worksheet(rows, widths) {
  const columns = widths.map((width, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>').join('');
  const data = rows.map((row, i) => {
    const cells = row.map((value, j) => {
      const cell = String.fromCharCode(65 + j) + (i + 1);
      if (value === null) return '<c r="' + cell + '"/>';
      if (typeof value === 'number') return '<c r="' + cell + '" s="2"><v>' + value + '</v></c>';
      return '<c r="' + cell + '" t="inlineStr" s="' + (i === 0 ? 1 : 0) + '"><is><t xml:space="preserve">' + xmlText(value) + '</t></is></c>';
    }).join('');
    return '<row r="' + (i + 1) + '">' + cells + '</row>';
  }).join('');
  return '<worksheet xmlns="' + spreadsheetNs + '"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + columns + '</cols><sheetData>' + data + '</sheetData><autoFilter ref="A1:' + String.fromCharCode(64 + widths.length) + rows.length + '"/></worksheet>';
}

function createPlanWorkbook(summaryRows, nodeRows, {zipSync, strToU8}) {
  const files = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/summary.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      <Override PartName="/xl/worksheets/nodes.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
    </Types>`,
    '_rels/.rels': `<Relationships xmlns="${packageRelNs}"><Relationship Id="rId1" Type="${officeRelNs}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${packageRelNs}">
      <Relationship Id="rId1" Type="${officeRelNs}/worksheet" Target="worksheets/summary.xml"/>
      <Relationship Id="rId2" Type="${officeRelNs}/worksheet" Target="worksheets/nodes.xml"/>
      <Relationship Id="rId3" Type="${officeRelNs}/styles" Target="styles.xml"/>
    </Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${spreadsheetNs}" xmlns:r="${officeRelNs}"><sheets>
      <sheet name="Monthly summary" sheetId="1" r:id="rId1"/><sheet name="Flow map" sheetId="2" r:id="rId2"/>
    </sheets></workbook>`,
    'xl/styles.xml': `<styleSheet xmlns="${spreadsheetNs}">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00;-&quot;$&quot;#,##0.00"/></numFmts>
      <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
      <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
      <borders count="1"><border/></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="3"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/><xf xfId="0" numFmtId="164" applyNumberFormat="1"/></cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`,
    'xl/worksheets/summary.xml': worksheet(summaryRows, [32, 16, 16, 18, 22, 16]),
    'xl/worksheets/nodes.xml': worksheet(nodeRows, [34, 16, 34, 18, 18])
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8('<?xml version="1.0" encoding="UTF-8"?>' + xml)])));
}
