import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { euros } from "../money";
import { dateLabel, monthLabel, timeLabel } from "../dates";
import { PAYMENT_LABEL } from "../constants";
import type { Breakdown } from "../money";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2420" },
  brand: { fontSize: 22, color: "#2f3227", fontFamily: "Times-Roman" },
  tagline: { fontSize: 7, color: "#626850", letterSpacing: 2, marginTop: 2, marginBottom: 12 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: "#66695e" },
  summary: { flexDirection: "row", marginTop: 18, marginBottom: 18, borderWidth: 1, borderColor: "#e8e7df", borderRadius: 6 },
  cell: { flex: 1, padding: 10, borderRightWidth: 1, borderColor: "#e8e7df" },
  cellLabel: { fontSize: 8, color: "#66695e", marginBottom: 4 },
  cellValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderColor: "#efeee8" },
  head: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1.5, borderColor: "#2f3227", fontFamily: "Helvetica-Bold" },
  c1: { width: 70 },
  c2: { flex: 1 },
  c3: { width: 45, textAlign: "right" },
  c4: { width: 55 },
  c5: { width: 70, textAlign: "right" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#66695e", textAlign: "center" },
});

export type StatementItem = {
  occurredAt: Date;
  label: string;
  quantity: number;
  paymentType: string;
  totalCents: number;
};

export function renderStatement(data: {
  creatorName: string;
  month: string;
  commissionRate: number;
  breakdown: Breakdown;
  items: StatementItem[];
}) {
  const b = data.breakdown;
  const doc = (
    <Document title={`Relevé ${data.creatorName} ${data.month}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>Les Songes Créatifs</Text>
        <Text style={s.tagline}>BOUTIQUE DE CRÉATEURS</Text>
        <Text style={s.title}>Relevé de ventes — {monthLabel(data.month)}</Text>
        <Text style={s.muted}>
          {data.creatorName} · édité le {dateLabel(new Date())}
        </Text>

        <View style={s.summary}>
          {[
            ["CA brut", euros(b.grossCents)],
            ["Frais SumUp", euros(b.feeCents)],
            [`Commission (${Math.round(data.commissionRate * 100)} %)`, euros(b.commissionCents)],
            ["Net à reverser", euros(b.netCents)],
            ["Articles", String(b.quantity)],
          ].map(([l, v]) => (
            <View key={l} style={s.cell}>
              <Text style={s.cellLabel}>{l}</Text>
              <Text style={s.cellValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.head} fixed>
          <Text style={s.c1}>Date</Text>
          <Text style={s.c2}>Article</Text>
          <Text style={s.c3}>Qté</Text>
          <Text style={s.c4}>Paiement</Text>
          <Text style={s.c5}>Montant</Text>
        </View>
        {data.items.map((it, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.c1}>
              {dateLabel(it.occurredAt).slice(0, 5)} {timeLabel(it.occurredAt)}
            </Text>
            <Text style={s.c2}>{it.label}</Text>
            <Text style={s.c3}>{it.quantity}</Text>
            <Text style={s.c4}>{PAYMENT_LABEL[it.paymentType] ?? it.paymentType}</Text>
            <Text style={s.c5}>{euros(it.totalCents)}</Text>
          </View>
        ))}
        {data.items.length === 0 && <Text style={[s.muted, { marginTop: 12 }]}>Aucune vente sur la période.</Text>}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Les Songes Créatifs — relevé ${data.creatorName} — page ${pageNumber}/${totalPages}`}
        />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
