import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { TileAnalysis } from "./schema";
import { DEFECT_TYPES } from "./defects";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0a0a0a",
    color: "#e5e5e5",
    fontFamily: "Helvetica",
    padding: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1 solid #262626",
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0ea5e9",
  },
  subtitle: {
    fontSize: 10,
    color: "#737373",
    marginTop: 4,
  },
  gradeBox: {
    alignItems: "center",
    padding: "8 16",
    borderRadius: 8,
    backgroundColor: "#1c1917",
  },
  gradeLabel: {
    fontSize: 8,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  gradeValue: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#0ea5e9",
  },
  gradeDesc: {
    fontSize: 8,
    color: "#737373",
    marginTop: 2,
  },
  photosRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  photoContainer: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 8,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  tilePhoto: {
    width: "100%",
    borderRadius: 6,
    objectFit: "cover",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#171717",
    borderRadius: 8,
    padding: "8 10",
  },
  statLabel: {
    fontSize: 8,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#e5e5e5",
  },
  passBadge: {
    fontSize: 8,
    color: "#4ade80",
    fontFamily: "Helvetica-Bold",
  },
  failBadge: {
    fontSize: 8,
    color: "#f87171",
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#a3a3a3",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#171717",
    padding: "5 8",
    borderRadius: "4 4 0 0",
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottom: "1 solid #262626",
  },
  tableCell: {
    flex: 1,
    fontSize: 8,
    color: "#e5e5e5",
  },
  tableCellSm: {
    flex: 0.7,
    fontSize: 8,
    color: "#e5e5e5",
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 7,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeaderCellSm: {
    flex: 0.7,
    fontSize: 7,
    color: "#737373",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reasoning: {
    marginTop: 16,
    backgroundColor: "#171717",
    borderRadius: 8,
    padding: 12,
  },
  reasoningText: {
    fontSize: 10,
    color: "#a3a3a3",
    lineHeight: 1.6,
    fontStyle: "italic",
  },
  standardsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
    paddingTop: 14,
    borderTop: "1 solid #262626",
  },
  standardsBadge: {
    backgroundColor: "#0c4a6e",
    borderRadius: 4,
    padding: "3 7",
  },
  standardsText: {
    fontSize: 8,
    color: "#7dd3fc",
    fontFamily: "Helvetica-Bold",
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionBodyText: {
    fontSize: 9,
    color: "#a3a3a3",
    lineHeight: 1.55,
  },
  bullet: {
    fontSize: 9,
    color: "#a3a3a3",
    lineHeight: 1.55,
    paddingLeft: 8,
    borderLeft: "2 solid #1e40af",
    marginBottom: 4,
  },
});

function gradeDescText(grade: string): string {
  if (grade === "A") return "First Quality";
  if (grade === "B") return "Second Quality";
  return "Commercial / Reject";
}

function useCaseText(useCase: string): string {
  switch (useCase) {
    case "wall":              return "Wall Only";
    case "residential_floor": return "Residential Floor";
    case "light_commercial":  return "Light Commercial";
    case "heavy_commercial":  return "Heavy Commercial";
    default:                  return "Reject";
  }
}

interface ReportDocumentProps {
  analysis: TileAnalysis;
  photos: string[]; // base64 no prefix
  photoMimes: string[];
  tileId?: string;
  timestamp: string;
  batchId?: string;
  manufacturer?: string;
  dimensions?: string;
}

export function ReportDocument({
  analysis,
  photos,
  photoMimes,
  tileId,
  timestamp,
  batchId,
  manufacturer,
  dimensions,
}: ReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>TileScope Report</Text>
            <Text style={styles.subtitle}>
              {tileId ? `Tile ${tileId}` : "Tile Inspection"} — {timestamp}
            </Text>
            {batchId && <Text style={styles.subtitle}>Batch: {batchId}</Text>}
            {manufacturer && <Text style={styles.subtitle}>Manufacturer: {manufacturer}</Text>}
            {dimensions && <Text style={styles.subtitle}>Dimensions: {dimensions}</Text>}
          </View>
          <View style={styles.gradeBox}>
            <Text style={styles.gradeLabel}>ISO Grade</Text>
            <Text style={styles.gradeValue}>{analysis.grade}</Text>
            <Text style={styles.gradeDesc}>{gradeDescText(analysis.grade)}</Text>
          </View>
        </View>

        {/* Photos */}
        {photos.length > 0 && (
          <View style={styles.photosRow}>
            {photos.map((photo, i) => (
              <View key={i} style={styles.photoContainer}>
                <Text style={styles.photoLabel}>
                  {i === 0 ? "Face" : i === 1 ? "Edge / Side" : "Corner / Detail"}
                </Text>
                <Image
                  src={`data:${photoMimes[i] ?? "image/jpeg"};base64,${photo}`}
                  style={styles.tilePhoto}
                />
              </View>
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Defects</Text>
            <Text style={styles.statValue}>{analysis.total_defects}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Use Case</Text>
            <Text style={styles.statValue}>{useCaseText(analysis.use_case)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>3 ft Check</Text>
            <Text style={analysis.viewing_distance_3ft ? styles.passBadge : styles.failBadge}>
              {analysis.viewing_distance_3ft ? "PASS" : "FAIL"}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>10 ft Check</Text>
            <Text style={analysis.viewing_distance_10ft ? styles.passBadge : styles.failBadge}>
              {analysis.viewing_distance_10ft ? "PASS" : "FAIL"}
            </Text>
          </View>
        </View>

        {/* Defect table */}
        <Text style={styles.sectionTitle}>Defect Inventory</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCellSm}>ID</Text>
          <Text style={styles.tableHeaderCell}>Type</Text>
          <Text style={styles.tableHeaderCellSm}>Zone</Text>
          <Text style={styles.tableHeaderCellSm}>Severity</Text>
          <Text style={styles.tableHeaderCellSm}>Confidence</Text>
        </View>
        {analysis.defects.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ ...styles.tableCell, color: "#737373", fontStyle: "italic" }}>
              No defects detected.
            </Text>
          </View>
        ) : (
          analysis.defects.map((d) => {
            const info = DEFECT_TYPES.find((t) => t.id === d.type);
            return (
              <View key={d.id} style={styles.tableRow}>
                <Text style={styles.tableCellSm}>#{d.id}</Text>
                <Text style={styles.tableCell}>{info?.name ?? d.type}</Text>
                <Text style={styles.tableCellSm}>{d.zone ?? "face"}</Text>
                <Text style={styles.tableCellSm}>{d.severity}</Text>
                <Text style={styles.tableCellSm}>{Math.round(d.confidence * 100)}%</Text>
              </View>
            );
          })
        )}

        {/* Reasoning */}
        <View style={styles.reasoning}>
          <Text style={styles.reasoningText}>{analysis.reasoning}</Text>
        </View>

        {/* Detailed analysis */}
        <View style={{ marginTop: 20 }}>
          <Text style={styles.sectionTitle}>AI Inspection Report</Text>

          <View style={styles.sectionBlock}>
            <Text style={{ ...styles.sectionTitle, fontSize: 8 }}>Overall Condition</Text>
            <Text style={styles.sectionBodyText}>{analysis.detailed_analysis.overall}</Text>
          </View>

          {analysis.detailed_analysis.notable_defects.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={{ ...styles.sectionTitle, fontSize: 8 }}>Notable Defects</Text>
              {analysis.detailed_analysis.notable_defects.map((d, i) => (
                <Text key={i} style={styles.bullet}>{d}</Text>
              ))}
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={{ ...styles.sectionTitle, fontSize: 8 }}>Grade Criteria Applied</Text>
            <Text style={styles.sectionBodyText}>{analysis.detailed_analysis.grade_criteria_applied}</Text>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={{ ...styles.sectionTitle, fontSize: 8 }}>Use-Case Suitability</Text>
            <Text style={styles.sectionBodyText}>{analysis.detailed_analysis.use_case_rationale}</Text>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={{ ...styles.sectionTitle, fontSize: 8 }}>Recommendations</Text>
            <Text style={styles.sectionBodyText}>{analysis.detailed_analysis.recommendations}</Text>
          </View>
        </View>

        {/* Standards footer */}
        <View style={styles.standardsRow}>
          {["ISO 10545-2", "EN 14411", "ANSI A137.1"].map((s) => (
            <View key={s} style={styles.standardsBadge}>
              <Text style={styles.standardsText}>{s}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
