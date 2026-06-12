# Fabric Notebook: Parse Inforcer Assessment PDFs into Delta Tables
#
# Default lakehouse must be set to: ManagedServiceData
#
# Reads PDFs from:
#   Files/copilot_readiness/*.pdf    -> copilot_readiness_assessments + _categories + _checks
#   Files/security_assessment/*.pdf  -> security_assessment_assessments + _categories + _checks
#
# Tables are upserted (MERGE / delete+insert) so re-runs are idempotent.
# Requires: PyMuPDF  (install via %pip install pymupdf)

# CELL 1 ---------------------------------------------------------------
# %pip install pymupdf --quiet

# CELL 2 ---------------------------------------------------------------
import re
import hashlib
from datetime import datetime, timezone
import fitz  # PyMuPDF
from pyspark.sql import Row
import notebookutils

COPILOT_FOLDER = "Files/copilot_readiness"
SECURITY_FOLDER = "Files/security_assessment"

VALID_STATUSES = {"Passed", "Failed", "Warning"}
VALID_PRIORITIES = {"High", "Medium", "Low"}


# CELL 3 ---------------------------------------------------------------
# --- IO helpers ---------------------------------------------------------------

def list_pdfs(folder_path):
    try:
        entries = notebookutils.fs.ls(folder_path)
    except Exception as e:
        print(f"Folder {folder_path} not accessible: {e}")
        return []
    return [f for f in entries if f.name.lower().endswith(".pdf")]


def read_pdf_text(file_path):
    raw = notebookutils.fs.head(file_path, 100 * 1024 * 1024)
    if isinstance(raw, str):
        raw = raw.encode("latin-1", errors="ignore")
    doc = fitz.open(stream=raw, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return text


def assessment_id_for(file_path):
    return hashlib.sha256(file_path.encode()).hexdigest()[:16]


# CELL 4 ---------------------------------------------------------------
# --- Shared parsers (both report types use the same Inforcer layout) ----------

def parse_header(text):
    out = {
        "assessment_name": None,
        "tenant_name": None,
        "assessment_date": None,
        "assessment_time": None,
    }
    m = re.search(r"Assessment:\s*\n([^\n]+)", text)
    if m:
        out["assessment_name"] = m.group(1).strip()
    m = re.search(r"Tenant Assessment:\s*\n([^\n]+)", text)
    if m:
        out["tenant_name"] = m.group(1).strip()
    m = re.search(r"Assessment Date:\s*\n([0-9\-/]+)", text)
    if m:
        out["assessment_date"] = m.group(1).strip()
    m = re.search(r"Assessment Time:\s*\n([0-9T:\-.Z]+)", text)
    if m:
        out["assessment_time"] = m.group(1).strip()
    return out


def parse_executive_summary(text):
    out = {"overall_score_pct": None, "passed": None, "failed": None, "warnings": None}
    m = re.search(r"Overall Score\s*\n\s*(\d+)\s*%", text)
    if m:
        out["overall_score_pct"] = int(m.group(1))
    m = re.search(r"Passed\s*\n\s*(\d+)\s*\n", text)
    if m:
        out["passed"] = int(m.group(1))
    m = re.search(r"Failed\s*\n\s*(\d+)\s*\n", text)
    if m:
        out["failed"] = int(m.group(1))
    m = re.search(r"Warnings\s*\n\s*(\d+)", text)
    if m:
        out["warnings"] = int(m.group(1))
    return out


def parse_categories(text):
    """
    "Assessment by Category (Top 5)" lines:
        M365 0%
        0 passed 2 failed
    """
    results = []
    pattern = re.compile(
        r"([A-Za-z0-9 &\-]+?)\s+(\d+)\s*%\s*\n\s*(\d+)\s+passed\s+(\d+)\s+failed",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        name = m.group(1).strip()
        if name.lower() in {"overall score"}:
            continue
        results.append({
            "category_name": name,
            "score_pct": int(m.group(2)),
            "passed": int(m.group(3)),
            "failed": int(m.group(4)),
        })
    return results


# CELL 5 ---------------------------------------------------------------
# --- Check-row parser ---------------------------------------------------------

CATEGORY_HEADER_RE = re.compile(
    r"([A-Z][A-Za-z0-9 &/]+?)\s*\(([^)]+)\)\s*\((\d+)\s*checks?\)"
)


def split_into_category_sections(text):
    start = text.find("Assessment Results by Category")
    if start == -1:
        return []
    body = text[start:]
    headers = list(CATEGORY_HEADER_RE.finditer(body))
    sections = []
    for i, h in enumerate(headers):
        end = headers[i + 1].start() if i + 1 < len(headers) else len(body)
        sections.append((h.group(1).strip(), h.group(2).strip(), body[h.end():end]))
    return sections


def _extract_control(framework_text):
    if not framework_text:
        return None
    m = re.search(r"Control:\s*([0-9.]+)", framework_text)
    return m.group(1) if m else None


def _extract_level(framework_text):
    if not framework_text:
        return None
    m = re.search(r"Level:\s*\(?(L[12])\)?", framework_text)
    return m.group(1) if m else None


def parse_checks_in_block(block):
    """
    Each check renders as:
        <check name lines>
        <sub-tag>
        <rationale paragraph...>
        <Status>           Failed | Passed | Warning
        <Priority>         High | Medium | Low
        <Framework lines>  e.g. "Copilot Readiness" OR
                                "CIS Microsoft 365 Foundations Benchmark v6.0.0"
                                "Control: 2.1.9"
                                "Level: (L1)"
    """
    lines = [ln.rstrip() for ln in block.split("\n")]
    checks = []
    n = len(lines)
    last_check_end = 0
    i = 0

    while i < n:
        line = lines[i].strip()
        if line in VALID_STATUSES:
            j = i + 1
            while j < n and not lines[j].strip():
                j += 1
            if j >= n:
                break
            priority = lines[j].strip()
            if priority not in VALID_PRIORITIES:
                i += 1
                continue

            # Collect framework lines after priority
            k = j + 1
            framework_lines = []
            while k < n:
                ln = lines[k].strip()
                if not ln:
                    p = k + 1
                    while p < n and not lines[p].strip():
                        p += 1
                    if p >= n:
                        break
                    nxt = lines[p].strip()
                    if nxt.startswith(("Control:", "Level:", "CIS ")) or nxt == "Copilot Readiness":
                        k = p
                        continue
                    break
                if ln in VALID_STATUSES:
                    break
                framework_lines.append(ln)
                k += 1

            framework_text = " | ".join(framework_lines).strip() or None

            # Check name = first few non-empty content lines between last_check_end and i
            name_lines = []
            for idx in range(last_check_end, i):
                t = lines[idx].strip()
                if not t:
                    if name_lines:
                        break
                    continue
                name_lines.append(t)
                if len(name_lines) >= 6:
                    break
            check_name = " ".join(name_lines).strip() or None

            checks.append({
                "check_name": check_name,
                "status": line,
                "priority": priority,
                "framework_raw": framework_text,
                "control": _extract_control(framework_text),
                "level": _extract_level(framework_text),
            })

            last_check_end = k
            i = k
            continue
        i += 1

    return checks


# CELL 6 ---------------------------------------------------------------
# --- Build rows + upsert ------------------------------------------------------

def build_rows(file_info, text, ingested_at):
    aid = assessment_id_for(file_info.path)
    header = parse_header(text)
    summary = parse_executive_summary(text)
    categories = parse_categories(text)
    sections = split_into_category_sections(text)

    assessment_row = Row(
        assessment_id=aid,
        file_name=file_info.name,
        file_path=file_info.path,
        assessment_name=header["assessment_name"],
        tenant_name=header["tenant_name"],
        assessment_date=header["assessment_date"],
        assessment_time=header["assessment_time"],
        overall_score_pct=summary["overall_score_pct"],
        passed_count=summary["passed"],
        failed_count=summary["failed"],
        warnings_count=summary["warnings"],
        ingested_at=ingested_at,
    )

    category_rows = [
        Row(
            assessment_id=aid,
            category_name=c["category_name"],
            score_pct=c["score_pct"],
            passed_count=c["passed"],
            failed_count=c["failed"],
            ingested_at=ingested_at,
        )
        for c in categories
    ]

    check_rows = []
    for category_label, area_code, block in sections:
        for c in parse_checks_in_block(block):
            check_rows.append(Row(
                assessment_id=aid,
                category_label=category_label,
                area_code=area_code,
                check_name=c["check_name"],
                status=c["status"],
                priority=c["priority"],
                framework_raw=c["framework_raw"],
                control=c["control"],
                level=c["level"],
                ingested_at=ingested_at,
            ))

    return assessment_row, category_rows, check_rows


def upsert(df, table_name, key_cols):
    if df.rdd.isEmpty():
        print(f"  no rows for {table_name}")
        return
    df.createOrReplaceTempView("staging")
    spark.sql(f"CREATE TABLE IF NOT EXISTS {table_name} USING DELTA AS SELECT * FROM staging WHERE 1=0")
    if len(key_cols) == 1:
        spark.sql(f"""
            MERGE INTO {table_name} t USING staging s ON t.{key_cols[0]} = s.{key_cols[0]}
            WHEN MATCHED THEN UPDATE SET *
            WHEN NOT MATCHED THEN INSERT *
        """)
    else:
        # Child tables: delete prior rows for the affected assessment_ids, then append
        ids = [r.assessment_id for r in df.select("assessment_id").distinct().collect()]
        id_list = ",".join([f"'{i}'" for i in ids])
        spark.sql(f"DELETE FROM {table_name} WHERE assessment_id IN ({id_list})")
        df.write.mode("append").format("delta").saveAsTable(table_name)
    print(f"  wrote {df.count()} row(s) to {table_name}")


def ingest_folder(folder_path, table_prefix):
    files = list_pdfs(folder_path)
    print(f"{folder_path}: {len(files)} PDF(s)")
    if not files:
        return

    now = datetime.now(timezone.utc)
    all_assessments, all_categories, all_checks = [], [], []
    for f in files:
        try:
            text = read_pdf_text(f.path)
            a, cats, chks = build_rows(f, text, now)
            all_assessments.append(a)
            all_categories.extend(cats)
            all_checks.extend(chks)
            print(f"  parsed {f.name}: {len(cats)} categories, {len(chks)} checks")
        except Exception as e:
            print(f"  FAILED {f.name}: {e}")

    if all_assessments:
        upsert(spark.createDataFrame(all_assessments), f"{table_prefix}_assessments", ["assessment_id"])
    if all_categories:
        upsert(spark.createDataFrame(all_categories), f"{table_prefix}_categories", ["assessment_id", "category_name"])
    if all_checks:
        upsert(spark.createDataFrame(all_checks), f"{table_prefix}_checks", ["assessment_id", "check_name"])


# CELL 7 ---------------------------------------------------------------
ingest_folder(COPILOT_FOLDER, "copilot_readiness")
ingest_folder(SECURITY_FOLDER, "security_assessment")

# CELL 8 ---------------------------------------------------------------
# display(spark.table("copilot_readiness_assessments"))
# display(spark.table("copilot_readiness_categories"))
# display(spark.table("copilot_readiness_checks"))
# display(spark.table("security_assessment_assessments"))
# display(spark.table("security_assessment_categories"))
# display(spark.table("security_assessment_checks"))
