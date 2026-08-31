import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = ".";
const rows = [
  [1, "AHMAD FIKKO AGIL ALAMSYAH", "L", "Provinsi Jawa Timur"],
  [2, "ATHALLAH NUR RAFIF", "L", "Provinsi Jawa Timur"],
  [3, "BIMA ADITYA NUGROHO", "L", "Provinsi Jawa Timur"],
  [4, "MUHAMAD IRFAN HAKIM", "L", "Provinsi Jawa Timur"],
  [5, "NAFAL FAUZAN NUGRAHA", "L", "Provinsi Jawa Timur"],
  [6, "POLITEIA SALMA NESTYAJATMIKO", "P", "Provinsi Jawa Timur"],
  [7, "WILDAN AUFAN FIKRI WAHYUDI", "L", "Provinsi Jawa Timur"],
  [8, "AGUNG MIRAH PRAYOGA", "P", "Bali / Kabupaten Badung"],
  [9, "INDRA RAY SANNURI", "L", "Jawa Timur / Bangkalan"],
  [10, "AMALIA MIFTAKHUL AFIFAH", "P", "Jawa Timur / Banyuwangi"],
  [11, "SEPTYAN STEPHANY FERNANDO", "L", "Jawa Timur / Banyuwangi"],
  [12, "KARINA ZAHRA' QADIRIYYAH", "P", "Jawa Timur / Blitar"],
  [13, "YOGA DWI WIDYA CANDRA", "L", "Jawa Timur / Bojonegoro"],
  [14, "KANTHI AMRIH LESTARI", "P", "Jawa Timur / Bondowoso"],
  [15, "ARYA WIBOWO", "L", "Jawa Timur / Gresik"],
  [16, "HERARETNANI ANGGEROWATI", "P", "Jawa Timur / Jombang"],
  [17, "MUHAMMAD NAUFAL PRAYOGA", "L", "Jawa Timur / Kediri"],
  [18, "ZATI HIMMATIL ALIYAH", "P", "Jawa Timur / Kota Batu"],
  [19, "MOHAMMAD HAIDAR SATRIYO LUHUR", "L", "Jawa Timur / Kota Kediri"],
  [20, "ARYN ISWARA", "P", "Jawa Timur / Kota Madiun"],
  [21, "DIANA ARINANDA ELFIRA", "P", "Jawa Timur / Kota Madiun"],
  [22, "ELINDA ABELIANA", "P", "Jawa Timur / Kota Madiun"],
  [23, "NURUL MUSDHALIFA ALMAGFIRA", "P", "Jawa Timur / Kota Madiun"],
  [24, "WAFIQ ALFIN KAMIL", "L", "Jawa Timur / Kota Malang"],
  [25, "ARYA RIZQI ADI PRATAMA", "L", "Jawa Timur / Kota Mojokerto"],
  [26, "VALENTINO ANDREW LENGKONG", "L", "Jawa Timur / Kota Pasuruan"],
  [27, "FARID DARWISY PRAYITNA", "L", "Jawa Timur / Kota Probolinggo"],
  [28, "ANNISA SALSABILA SANTOSO", "P", "Jawa Timur / Kota Surabaya"],
  [29, "DWI AJENG AYU FARAHDILAH AKBAR", "P", "Jawa Timur / Kota Surabaya"],
  [30, "FEBYANTI RACHMAN", "P", "Jawa Timur / Kota Surabaya"],
  [31, "SITI IFADOH", "P", "Jawa Timur / Kota Surabaya"],
  [32, "DODY ELZA FIRMAN CAHYO", "L", "Jawa Timur / Lamongan"],
  [33, "AVRILIA BUDIAR GARDA PRINCESSA", "P", "Jawa Timur / Lumajang"],
  [34, "EVITA MARSELLIA SALSABILA", "P", "Jawa Timur / Lumajang"],
  [35, "FAHMI AHMAD NAUFAL FAIZIN", "L", "Jawa Timur / Lumajang"],
  [36, "SABRINA OKTAVIANA OLANG", "P", "Jawa Timur / Lumajang"],
  [37, "JOSUA IMANUEL VASCO AGOW", "L", "Jawa Timur / Madiun"],
  [38, "SALSABILLA DIFA SAPHIRA", "P", "Jawa Timur / Magetan"],
  [39, "MUHAMMAD AKMAL MURODI", "L", "Jawa Timur / Malang"],
  [40, "NALOM JONATAN HASIBUAN", "L", "Jawa Timur / Malang"],
  [41, "HAFADZ MALIK HAQIQI", "L", "Jawa Timur / Mojokerto"],
  [42, "ALDI IRVAN MANTOFANI", "L", "Jawa Timur / Nganjuk"],
  [43, "PUTRI RIANG IHZA MAHZIDA", "P", "Jawa Timur / Nganjuk"],
  [44, "RAFIF ENDRA PUTRA", "L", "Jawa Timur / Nganjuk"],
  [45, "ANDIKA ARYA PRATAMA", "L", "Jawa Timur / Ngawi"],
  [46, "FERNANDA EZRA AFIAWAN", "L", "Jawa Timur / Pacitan"],
  [47, "PUTRI LUISA MAHARANI SUI", "P", "Jawa Timur / Pacitan"],
  [48, "MOHAMMAD RAIHAN BAHRESY", "L", "Jawa Timur / Pamekasan"],
  [49, "CITRA ARIANI", "P", "Jawa Timur / Pasuruan"],
  [50, "DEWI VERAWATI", "P", "Jawa Timur / Ponorogo"],
  [51, "ERLITA MAHARANIE", "P", "Jawa Timur / Ponorogo"],
  [52, "HAFIZAH SALWA SALSABILA", "P", "Jawa Timur / Ponorogo"],
  [53, "MOCH. ROZIQUR ROZAQ", "L", "Jawa Timur / Ponorogo"],
  [54, "SUKMAYANTI SUKRI", "P", "Jawa Timur / Ponorogo"],
  [55, "MUHAMMAD DHANY SAPUTRA", "L", "Jawa Timur / Probolinggo"],
  [56, "SURYA NURIL HUDA", "L", "Jawa Timur / Sampang"],
  [57, "ADIB HARIS ASLAM", "L", "Jawa Timur / Sidoarjo"],
  [58, "KIRANA PUTRI FAUZI RASENDRIYAH", "P", "Jawa Timur / Sidoarjo"],
  [59, "NI PUTU NIA FEBYLINA NATALIA", "P", "Jawa Timur / Sidoarjo"],
  [60, "REINALDY NOVANKA NUGRAHA", "L", "Jawa Timur / Sidoarjo"],
  [61, "YASMINE FA'I PUTRI", "P", "Jawa Timur / Sidoarjo"],
  [62, "PUTRA ARIF FAHREZI", "L", "Jawa Timur / Situbondo"],
  [63, "RANGGA PAMBUDI", "L", "Jawa Timur / Sumenep"],
  [64, "EARLY AURA ARDIANSYAH", "L", "Jawa Timur / Trenggalek"],
  [65, "MUHAMMAD NAUFAL RIVALDI", "L", "Jawa Timur / Tuban"],
  [66, "ANISA SHINFI AFIFA", "P", "Jawa Timur / Tulungagung"],
  [67, "AZ ZAHRA HANA WIJAYA", "P", "Jawa Timur / Tulungagung"],
  [68, "FARID ADE SETIAWAN", "L", "Jawa Timur / Tulungagung"],
  [69, "HAWA AULIA AFIEF", "P", "Jawa Timur / Tulungagung"],
  [70, "BRIGITTA SYLVIA", "P", "Kepulauan Riau / Kota Batam"],
  [71, "WIDIYA YUSKA", "P", "Nusa Tenggara Barat / Kabupaten Lombok Tengah"],
  [72, "FARRAS AL MUNAWWAR", "L", "Kementerian Dalam Negeri"],
  [73, "GHUFRON GHOZI RAMADHAN", "L", "Kementerian Dalam Negeri"],
  [74, "IZZATUL HAQ", "P", "Kementerian Dalam Negeri"],
  [75, "MUSTIKO FEBRI ADI PRAYOGA", "L", "Kementerian Desa dan Pembangunan Daerah Tertinggal"],
  [76, "ABIDAH ARDELIA ALFITA", "P", "Kementerian Koordinator Bidang Pembangunan Manusia dan Kebudayaan"],
  [77, "NABILA FAKHIRAH ALMA", "P", "Kementerian Pertanian"],
];

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Data");
sheet.showGridLines = false;

sheet.getRange("A1:D1").values = [["NO", "NAMA", "JK", "TUJUAN PENEMPATAN"]];
sheet.getRangeByIndexes(1, 0, rows.length, 4).values = rows;

const fullRange = sheet.getRange(`A1:D${rows.length + 1}`);
fullRange.format = {
  font: { name: "Arial", size: 10 },
  borders: { preset: "all", style: "thin", color: "#7F7F7F" },
};
sheet.getRange("A1:D1").format = {
  fill: "#D9EAF7",
  font: { bold: true, color: "#111111", name: "Arial", size: 10 },
  borders: { preset: "all", style: "thin", color: "#555555" },
};
sheet.getRange(`A2:A${rows.length + 1}`).format = { horizontalAlignment: "center" };
sheet.getRange(`C2:C${rows.length + 1}`).format = { horizontalAlignment: "center" };
sheet.getRange(`B2:B${rows.length + 1}`).format = { horizontalAlignment: "left" };
sheet.getRange(`D2:D${rows.length + 1}`).format = { horizontalAlignment: "left", wrapText: true };
sheet.getRange("A:A").format.columnWidth = 8;
sheet.getRange("B:B").format.columnWidth = 38;
sheet.getRange("C:C").format.columnWidth = 8;
sheet.getRange("D:D").format.columnWidth = 58;
sheet.getRange("A1:D1").format.rowHeight = 26;
sheet.getRange(`A2:D${rows.length + 1}`).format.rowHeight = 22;
sheet.getRange("D72:D77").format.rowHeight = 34;
sheet.freezePanes.freezeRows(1);
sheet.getRange(`C2:C${rows.length + 1}`).dataValidation = { rule: { type: "list", values: ["L", "P"] } };
const table = sheet.tables.add(`A1:D${rows.length + 1}`, true, "PenempatanTable");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

const notes = workbook.worksheets.add("Info");
notes.showGridLines = false;
notes.getRange("A1").values = [["Keterangan"]];
notes.getRange("A2:B6").values = [
  ["Sumber", "Diketik ulang dari 3 foto WhatsApp yang diberikan pengguna."],
  ["Dokumen", "Lampiran Surat Menteri Dalam Negeri Nomor 800.1.2.3/5533/SJ"],
  ["Tanggal dokumen", "29 Juli 2026"],
  ["Judul", "Penempatan Lulusan IPDN Angkatan XXXIII Tahun 2026"],
  ["Provinsi", "Jawa Timur"],
];
notes.getRange("A1:B1").merge();
notes.getRange("A1").format = { fill: "#D9EAF7", font: { bold: true, size: 12 } };
notes.getRange("A2:A6").format = { font: { bold: true }, fill: "#F2F2F2" };
notes.getRange("A1:B6").format.borders = { preset: "all", style: "thin", color: "#BFBFBF" };
notes.getRange("A:A").format.columnWidth = 20;
notes.getRange("B:B").format.columnWidth = 70;

const inspect = await workbook.inspect({
  kind: "table",
  range: "Data!A1:D78",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 4,
});
console.log(inspect.ndjson);

const preview = await workbook.render({ sheetName: "Data", range: "A1:D78", scale: 1, format: "png" });
console.log(`Preview bytes: ${(await preview.arrayBuffer()).byteLength}`);

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
const base64 = Buffer.from(xlsx.data).toString("base64");
await fs.writeFile(`${outputDir}/workbook_payload.txt`, base64, "utf8");
console.log("H:/qr-signer/outputs/image-to-excel/workbook_payload.txt");
