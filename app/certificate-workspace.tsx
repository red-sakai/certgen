"use client";

import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
import JSZip from "jszip";

type TemplateId = "classic" | "modern" | "minimal";
type Orientation = "portrait" | "landscape";
type SignatureMode = "text" | "image";

const templates: { id: TemplateId; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
];

const orientations: { id: Orientation; label: string }[] = [
  { id: "portrait", label: "Portrait" },
  { id: "landscape", label: "Landscape" },
];

const signatureModes: { id: SignatureMode; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "image", label: "Image" },
];

type CsvBatch =
  | { status: "empty" }
  | { status: "loading"; name: string }
  | {
      status: "ready";
      name: string;
      rowCount: number;
      previewName: string;
      names: string[];
    }
  | { status: "error"; message: string };

type ImageAsset =
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ready"; name: string; dataUrl: string };

type Fields = {
  organization: string;
  recognition: string;
  subtext: string;
  date: string;
  signerName: string;
  signerTitle: string;
};

const defaultSubtext =
  "This certificate is issued to {{name}} as he/she has completed the {{recognition}}.";

const emptyFields: Fields = {
  organization: "",
  recognition: "",
  subtext: defaultSubtext,
  date: "",
  signerName: "",
  signerTitle: "",
};

function resolveSubtext(
  subtext: string,
  recipientName: string,
  recognition: string,
): string {
  if (subtext.trim() === "") return "";
  const nameValue = recipientName.trim() || "Recipient name";
  const recognitionValue = recognition.trim() || "Recognition title";
  return subtext
    .replace(/\{\{\s*name\s*\}\}|<<\s*name\s*>>/gi, nameValue)
    .replace(/\{\{\s*recognition\s*\}\}|<<\s*recognition\s*>>/gi, recognitionValue);
}

function formatDisplayDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isCsvFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

function isPngFile(file: File): boolean {
  const byName = file.name.toLowerCase().endsWith(".png");
  const byType = file.type === "image/png";
  return byName || byType;
}

function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function sanitizeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "certificate"
  );
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readImagePng(
  file: File,
  onReady: (asset: ImageAsset) => void,
): void {
  if (!isPngFile(file)) {
    onReady({
      status: "error",
      message: `${file.name} is not a PNG. Choose a .png file and try again.`,
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== "string") {
      onReady({
        status: "error",
        message: "The image could not be read. Try another PNG.",
      });
      return;
    }
    onReady({
      status: "ready",
      name: file.name,
      dataUrl: reader.result,
    });
  };
  reader.onerror = () => {
    onReady({
      status: "error",
      message: "The image could not be read. Try another PNG.",
    });
  };
  reader.readAsDataURL(file);
}

export function CertificateWorkspace() {
  const [template, setTemplate] = useState<TemplateId>("classic");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [notice, setNotice] = useState<string | null>(null);
  const [csv, setCsv] = useState<CsvBatch>({ status: "empty" });
  const [logo, setLogo] = useState<ImageAsset>({ status: "empty" });
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("text");
  const [signatureImage, setSignatureImage] = useState<ImageAsset>({
    status: "empty",
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportRecipient, setExportRecipient] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const exportSheetRef = useRef<HTMLDivElement>(null);

  function update(key: keyof Fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setNotice(null);
  }

  function handleCsvFile(file: File | undefined) {
    if (!file) {
      setCsv({ status: "empty" });
      return;
    }

    if (!isCsvFileName(file.name)) {
      setCsv({
        status: "error",
        message: "That file is not a .csv. Choose a CSV list and try again.",
      });
      return;
    }

    setCsv({ status: "loading", name: file.name });

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const { headers, rows } = parseCsv(text);
      const nameIndex = headers.indexOf("name");

      if (nameIndex === -1) {
        setCsv({
          status: "error",
          message:
            'Missing column header "name". The first row must include a name column for recipients.',
        });
        return;
      }

      const namedRows = rows.filter((row) => (row[nameIndex] ?? "").trim() !== "");
      if (namedRows.length === 0) {
        setCsv({
          status: "error",
          message:
            'No recipient names under the "name" header. Add rows and re-upload.',
        });
        return;
      }

      const names = namedRows.map((row) => row[nameIndex].trim());

      setCsv({
        status: "ready",
        name: file.name,
        rowCount: names.length,
        previewName: names[0],
        names,
      });
      setSelectedName(names[0]);
      setGalleryPage(0);
      setNotice(null);
    };
    reader.onerror = () => {
      setCsv({
        status: "error",
        message: "The file could not be read. Try exporting the CSV again.",
      });
    };
    reader.readAsText(file);
  }

  function clearAll() {
    setFields(emptyFields);
    setLogo({ status: "empty" });
    setSignatureMode("text");
    setSignatureImage({ status: "empty" });
    setSelectedName(null);
    setGalleryPage(0);
    setNotice(null);
  }

  // Export: 1 recipient -> PNG; 2+ recipients -> ZIP of PNGs.
  async function handleExport() {
    if (csv.status !== "ready") {
      setNotice(
        'Upload a CSV with a name column first. Recipients come from the file, not a single field.',
      );
      return;
    }
    if (isExporting) return;

    const { names } = csv;
    setIsExporting(true);
    setNotice(null);

    try {
      if (names.length === 1) {
        const dataUrl = await captureCertificate(names[0]);
        downloadDataUrl(
          dataUrl,
          `certificate-${sanitizeFileName(names[0])}.png`,
        );
        setNotice(`Exported 1 certificate as PNG (${names[0]}).`);
        return;
      }

      const zip = new JSZip();
      const used = new Map<string, number>();

      for (const rawName of names) {
        const dataUrl = await captureCertificate(rawName);
        const base = sanitizeFileName(rawName);
        const count = used.get(base) ?? 0;
        used.set(base, count + 1);
        const fileName =
          count === 0 ? `${base}.png` : `${base}-${count + 1}.png`;
        zip.file(fileName, dataUrl.split(",")[1], { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "certificates.zip");
      setNotice(
        `Exported ${names.length} certificates as ZIP (certificates.zip).`,
      );
    } catch {
      setNotice(
        "Export failed while rendering a certificate. Check the logo or signature PNG, then try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function captureCertificate(name: string): Promise<string> {
    const node = exportSheetRef.current;
    if (!node) {
      throw new Error("Export surface missing");
    }

    flushSync(() => {
      setExportRecipient(name);
    });

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    return toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: false,
    });
  }

  const dateDisplay = formatDisplayDate(fields.date);
  const csvNames =
    csv.status === "ready" ? csv.names : ([] as string[]);
  const activeRecipient =
    selectedName && csvNames.includes(selectedName)
      ? selectedName
      : (csvNames[0] ?? "");
  const recipientName = activeRecipient;
  const recipientEmpty = recipientName.trim() === "";
  const recognitionEmpty = fields.recognition.trim() === "";
  const subtextEmpty = fields.subtext.trim() === "";
  const logoSrc = logo.status === "ready" ? logo.dataUrl : null;
  const signatureSrc =
    signatureMode === "image" && signatureImage.status === "ready"
      ? signatureImage.dataUrl
      : null;
  const activeTemplate =
    templates.find((item) => item.id === template)?.label ?? "Classic";
  const activeOrientation =
    orientations.find((item) => item.id === orientation)?.label ?? "Portrait";
  const sheetAspect =
    orientation === "portrait" ? "aspect-[8.5/11]" : "aspect-[11/8.5]";
  const sheetMaxWidth =
    orientation === "portrait" ? "max-w-2xl" : "max-w-3xl";

  const sharedCertProps = {
    fields,
    dateDisplay,
    recipientName,
    recipientEmpty,
    recognitionEmpty,
    subtextEmpty,
    logoSrc,
    signatureSrc,
  };

  const galleryPageSize = 8;
  const galleryTotalPages = Math.max(
    1,
    Math.ceil(csvNames.length / galleryPageSize),
  );
  const galleryStart = galleryPage * galleryPageSize;
  const gallerySlice = csvNames.slice(
    galleryStart,
    galleryStart + galleryPageSize,
  );
  const showGallery = csvNames.length > 1;

  return (
    <div className="mx-auto w-full max-w-[112rem] px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:gap-14">
        <section aria-labelledby="fields-legend" className="min-w-0">
          <fieldset className="min-w-0 border-0 p-0">
            <legend
              id="fields-legend"
              className="mb-1 font-serif text-lg font-bold text-ink"
            >
              Certificate fields
            </legend>
            <p className="mb-5 text-sm leading-6 text-ink-muted">
              Shared details here. Recipient names come from the CSV.
            </p>

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleExport();
              }}
            >
              <div className="flex flex-col gap-4 border-t border-rule pt-4">
                <Field
                  id="organization"
                  label="Organization"
                  value={fields.organization}
                  onChange={(v) => update("organization", v)}
                  placeholder="Name on the certificate"
                  autoComplete="organization"
                />
                <ImageUpload
                  id="logo-upload"
                  label="Organization logo (optional, PNG)"
                  hint="Shows on the certificate when set."
                  asset={logo}
                  onChange={(asset) => {
                    setLogo(asset);
                    setNotice(null);
                  }}
                />
                <TextArea
                  id="recognition"
                  label="Recognition"
                  value={fields.recognition}
                  onChange={(v) => update("recognition", v)}
                  placeholder={"Award, course, or achievement\nUse Enter for a new line"}
                  rows={3}
                />
                <TextArea
                  id="subtext"
                  label="Subtext"
                  value={fields.subtext}
                  onChange={(v) => update("subtext", v)}
                  placeholder={defaultSubtext}
                  rows={3}
                  hint="Prints under Recognition. Use {{name}} and {{recognition}} for the recipient and award. Leave empty to hide."
                />
                <Field
                  id="date"
                  label="Date"
                  type="date"
                  value={fields.date}
                  onChange={(v) => update("date", v)}
                  placeholder=""
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-4 border-t border-rule pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Recipients (CSV)
                </p>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="csv-upload"
                    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md border border-field-border bg-paper px-5 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-paper-raised peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                  >
                    Upload CSV
                  </label>
                  <input
                    id="csv-upload"
                    name="csv-upload"
                    type="file"
                    accept=".csv,text/csv,application/vnd.ms-excel"
                    className="peer sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      handleCsvFile(file);
                      event.target.value = "";
                    }}
                  />

                  <div aria-live="polite">
                    {csv.status === "empty" ? (
                      <p className="text-sm leading-6 text-ink-muted">
                        Required. Header row must include a{" "}
                        <span className="font-semibold text-ink">name</span>{" "}
                        column, then one recipient per row.
                      </p>
                    ) : csv.status === "loading" ? (
                      <p className="text-sm leading-6 text-ink">
                        Reading {csv.name}...
                      </p>
                    ) : csv.status === "error" ? (
                      <p className="rounded-md border border-field-border bg-paper-raised px-3 py-3 text-sm leading-6 text-ink">
                        {csv.message}
                      </p>
                    ) : (
                      <div className="rounded-md border border-field-border bg-paper-raised px-3 py-3 text-sm leading-6 text-ink">
                        <p className="font-semibold">{csv.name}</p>
                        <p className="text-ink-muted">
                          {csv.rowCount} recipient
                          {csv.rowCount === 1 ? "" : "s"} ready. Preview
                          shows first name.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCsv({ status: "empty" });
                            setNotice(null);
                          }}
                          className="mt-2 min-h-11 text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
                        >
                          Remove CSV
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-rule pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Signature block
                </p>

                <div
                  role="radiogroup"
                  aria-label="Signature style"
                  className="flex flex-wrap gap-2"
                >
                  {signatureModes.map((item) => {
                    const selected = signatureMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setSignatureMode(item.id);
                          setNotice(null);
                        }}
                        className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                          selected
                            ? "border-accent bg-white text-accent"
                            : "border-field-border bg-white text-ink hover:border-ink-muted"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {signatureMode === "text" ? (
                  <>
                    <Field
                      id="signerName"
                      label="Signed by"
                      value={fields.signerName}
                      onChange={(v) => update("signerName", v)}
                      placeholder="Printed name"
                      autoComplete="off"
                    />
                    <Field
                      id="signerTitle"
                      label="Signer title"
                      value={fields.signerTitle}
                      onChange={(v) => update("signerTitle", v)}
                      placeholder="Role or position"
                      autoComplete="off"
                    />
                  </>
                ) : (
                  <>
                    <ImageUpload
                      id="signature-upload"
                      label="Signature image (PNG)"
                      hint="Used in place of the printed name."
                      asset={signatureImage}
                      onChange={(asset) => {
                        setSignatureImage(asset);
                        setNotice(null);
                      }}
                    />
                    <Field
                      id="signerTitle"
                      label="Signer title"
                      value={fields.signerTitle}
                      onChange={(v) => update("signerTitle", v)}
                      placeholder="Role or position"
                      autoComplete="off"
                    />
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-rule pt-4">
                <button
                  type="submit"
                  disabled={isExporting}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-semibold text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isExporting
                    ? "Exporting..."
                    : csv.status === "ready" && csv.rowCount > 1
                      ? `Export ${csv.rowCount} PNGs as ZIP`
                      : "Export certificate PNG"}
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={isExporting}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-field-border bg-paper px-5 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Clear fields
                </button>
              </div>

              <div aria-live="polite">
                {notice ? (
                  <p className="rounded-md border border-field-border bg-paper-raised px-3 py-3 text-sm leading-6 text-ink">
                    {notice}
                  </p>
                ) : null}
              </div>
            </form>
          </fieldset>
        </section>

        <section aria-labelledby="sheet-label" className="min-w-0">
          <div className="rounded-md border border-field-border bg-paper-raised p-3 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2
                  id="sheet-label"
                  className="font-serif text-lg font-bold text-ink"
                >
                  Desk
                </h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {activeTemplate} · {activeOrientation}
                  {recipientName ? ` · ${recipientName}` : ""}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div
                  role="radiogroup"
                  aria-label="Certificate orientation"
                  className="flex flex-wrap gap-2"
                >
                  {orientations.map((item) => {
                    const selected = orientation === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setOrientation(item.id);
                          setNotice(null);
                        }}
                        className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                          selected
                            ? "border-accent bg-white text-accent"
                            : "border-field-border bg-white text-ink hover:border-ink-muted"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div
                  role="radiogroup"
                  aria-label="Certificate template"
                  className="flex flex-wrap gap-2"
                >
                  {templates.map((item) => {
                    const selected = template === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setTemplate(item.id);
                          setNotice(null);
                        }}
                        className={`group flex min-h-11 min-w-[7.5rem] flex-col items-stretch gap-1 rounded-sm border bg-white p-1.5 transition-all duration-150 ${
                          selected
                            ? "border-accent shadow-sm"
                            : "border-field-border hover:border-ink-muted"
                        }`}
                      >
                        <SwatchPreview templateId={item.id} active={selected} />
                        <span
                          className={`px-0.5 pb-0.5 text-left text-xs font-semibold ${
                            selected ? "text-accent" : "text-ink"
                          }`}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 bg-desk p-4 sm:p-8">
              <div
                key={`${template}-${orientation}`}
                className={`relative mx-auto ${sheetAspect} w-full ${sheetMaxWidth} animate-[fade-in_180ms_ease-out] bg-white shadow-[0_12px_28px_-12px_rgba(28,26,23,0.35),0_2px_6px_rgba(28,26,23,0.12)] ${
                  template === "classic"
                    ? "border-4 border-double border-ink p-5 sm:p-8"
                    : template === "modern"
                      ? "border-l-8 border-t border-r border-b border-accent p-5 sm:p-8"
                      : "border border-rule p-5 sm:p-8"
                }`}
              >
                {template === "classic" ? (
                  <ClassicCertificate {...sharedCertProps} />
                ) : template === "modern" ? (
                  <ModernCertificate {...sharedCertProps} />
                ) : (
                  <MinimalCertificate {...sharedCertProps} />
                )}
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-ink-muted">
              {showGallery
                ? "Select a recipient below to load it on the desk."
                : "Recipient name comes from the first CSV row. Empty slots show placeholders until you fill the fields."}
            </p>
          </div>

          {showGallery ? (
            <div className="mt-4 rounded-md border border-field-border bg-paper-raised p-3 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-serif text-lg font-bold text-ink">
                  Certificate previews
                </h3>
                <p className="text-sm text-ink-muted">
                  {csvNames.length} recipients · showing{" "}
                  {galleryStart + 1}-
                  {Math.min(galleryStart + galleryPageSize, csvNames.length)}
                </p>
              </div>

              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallerySlice.map((name, sliceIndex) => {
                  const absoluteIndex = galleryStart + sliceIndex;
                  const isSelected = name === activeRecipient;
                  return (
                    <li key={`${name}-${absoluteIndex}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedName(name);
                          setNotice(null);
                        }}
                        aria-pressed={isSelected}
                        className={`flex w-full flex-col gap-2 rounded-md border bg-white p-2 text-left transition-colors duration-150 ${
                          isSelected
                            ? "border-accent shadow-sm"
                            : "border-field-border hover:border-ink-muted"
                        }`}
                      >
                        <CertificateMini
                          orientation={orientation}
                          template={template}
                        >
                          {renderCertificate(template, {
                            ...sharedCertProps,
                            recipientName: name,
                            recipientEmpty: name.trim() === "",
                          })}
                        </CertificateMini>
                        <span className="min-w-0">
                          <span className="block text-xs text-ink-muted">
                            {absoluteIndex + 1}
                          </span>
                          <span
                            className={`block truncate text-sm font-semibold ${
                              isSelected ? "text-accent" : "text-ink"
                            }`}
                            title={name}
                          >
                            {name}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {galleryTotalPages > 1 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryPage((page) => Math.max(0, page - 1))
                    }
                    disabled={galleryPage === 0}
                    className="min-h-11 rounded-md border border-field-border bg-paper px-4 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <p className="text-sm text-ink-muted">
                    Page {galleryPage + 1} of {galleryTotalPages}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryPage((page) =>
                        Math.min(galleryTotalPages - 1, page + 1),
                      )
                    }
                    disabled={galleryPage >= galleryTotalPages - 1}
                    className="min-h-11 rounded-md border border-field-border bg-paper px-4 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-paper-raised disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <div
        ref={exportSheetRef}
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: -10000,
          width: orientation === "portrait" ? 850 : 1100,
          height: orientation === "portrait" ? 1100 : 850,
          pointerEvents: "none",
          zIndex: -1,
        }}
        className={`box-border bg-white ${
          template === "classic"
            ? "border-4 border-double border-ink p-10"
            : template === "modern"
              ? "border-l-8 border-t border-r border-b border-accent p-10"
              : "border border-rule p-10"
        }`}
      >
        {template === "classic" ? (
          <ClassicCertificate
            {...sharedCertProps}
            recipientName={exportRecipient}
            recipientEmpty={exportRecipient.trim() === ""}
          />
        ) : template === "modern" ? (
          <ModernCertificate
            {...sharedCertProps}
            recipientName={exportRecipient}
            recipientEmpty={exportRecipient.trim() === ""}
          />
        ) : (
          <MinimalCertificate
            {...sharedCertProps}
            recipientName={exportRecipient}
            recipientEmpty={exportRecipient.trim() === ""}
          />
        )}
      </div>
    </div>
  );
}

function SwatchPreview({
  templateId,
  active,
}: {
  templateId: TemplateId;
  active: boolean;
}) {
  const edge = active ? "border-accent" : "border-rule";
  const accentLine = templateId === "modern" ? "bg-accent" : "bg-ink";

  if (templateId === "classic") {
    return (
      <span
        aria-hidden
        className={`block h-10 w-full border-2 border-double ${edge} p-1`}
      >
        <span className="flex h-full flex-col items-center justify-center gap-0.5">
          <span className="block h-0.5 w-6 bg-ink-muted/50" />
          <span className="block h-1 w-10 bg-ink/70" />
          <span className="block h-0.5 w-7 bg-ink-muted/40" />
        </span>
      </span>
    );
  }

  if (templateId === "modern") {
    return (
      <span
        aria-hidden
        className={`flex h-10 w-full border ${edge} p-1 pl-1.5`}
      >
        <span className={`mr-1.5 h-full w-1 shrink-0 ${accentLine}`} />
        <span className="flex flex-1 flex-col justify-center gap-1">
          <span className="block h-1 w-3/4 bg-ink/70" />
          <span className="block h-0.5 w-1/2 bg-ink-muted/50" />
          <span className="block h-0.5 w-2/3 bg-ink-muted/40" />
        </span>
      </span>
    );
  }

  return (
    <span aria-hidden className={`block h-10 w-full border ${edge} p-1.5`}>
      <span className="flex h-full flex-col justify-center gap-1.5">
        <span className="block h-1 w-2/3 bg-ink/70" />
        <span className="block h-px w-4 bg-ink" />
        <span className="block h-0.5 w-1/2 bg-ink-muted/50" />
      </span>
    </span>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="min-h-11 w-full rounded-md border border-field-border bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink-muted transition-colors duration-150 hover:border-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="min-h-24 w-full resize-y rounded-md border border-field-border bg-white px-3 py-2.5 text-base leading-6 text-ink placeholder:text-ink-muted transition-colors duration-150 hover:border-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      <p className="text-xs leading-5 text-ink-muted">
        {hint ?? "Press Enter for a new line on the certificate."}
      </p>
    </div>
  );
}

function renderCertificate(
  template: TemplateId,
  props: CertificateBaseProps,
) {
  if (template === "classic") return <ClassicCertificate {...props} />;
  if (template === "modern") return <ModernCertificate {...props} />;
  return <MinimalCertificate {...props} />;
}

function CertificateMini({
  orientation,
  template,
  children,
}: {
  orientation: Orientation;
  template: TemplateId;
  children: ReactNode;
}) {
  const srcW = orientation === "portrait" ? 850 : 1100;
  const srcH = orientation === "portrait" ? 1100 : 850;
  const displayW = 150;
  const scale = displayW / srcW;
  const displayH = Math.round(srcH * scale);

  const borderClass =
    template === "classic"
      ? "border-2 border-double border-ink p-6"
      : template === "modern"
        ? "border-l-8 border-t border-r border-b border-accent p-6"
        : "border border-rule p-6";

  return (
    <div
      className="relative overflow-hidden bg-white"
      style={{ width: displayW, height: displayH }}
    >
      <div
        style={{
          width: srcW,
          height: srcH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
        className={`box-border bg-white ${borderClass}`}
      >
        {children}
      </div>
    </div>
  );
}

function ImageUpload({
  id,
  label,
  hint,
  asset,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  asset: ImageAsset;
  onChange: (asset: ImageAsset) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-semibold text-ink">
        {label}
      </span>
      <p className="text-xs leading-5 text-ink-muted">{hint}</p>

      <label
        htmlFor={id}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md border border-field-border bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-paper-raised peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
      >
        {asset.status === "ready" ? "Replace PNG" : "Upload PNG"}
      </label>
      <input
        id={id}
        name={id}
        type="file"
        accept="image/png,.png"
        className="peer sr-only"
        aria-labelledby={`${id}-label`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            onChange({ status: "empty" });
            event.target.value = "";
            return;
          }
          readImagePng(file, onChange);
          event.target.value = "";
        }}
      />

      <div aria-live="polite">
        {asset.status === "error" ? (
          <p className="rounded-md border border-field-border bg-paper-raised px-3 py-2 text-sm leading-5 text-ink">
            {asset.message}
          </p>
        ) : asset.status === "ready" ? (
          <div className="flex items-center gap-3 rounded-md border border-field-border bg-paper-raised px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.dataUrl}
              alt=""
              className="h-10 w-10 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {asset.name}
              </p>
              <button
                type="button"
                onClick={() => onChange({ status: "empty" })}
                className="min-h-11 text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Slot({
  value,
  placeholder,
  className = "",
}: {
  value: string;
  placeholder: string;
  className?: string;
}) {
  const empty = value.trim() === "";
  return (
    <span className={className}>
      {empty ? (
        <span className="text-ink-muted italic">{placeholder}</span>
      ) : (
        value
      )}
    </span>
  );
}

type CertificateBaseProps = {
  fields: Fields;
  dateDisplay: string;
  recipientName: string;
  recipientEmpty: boolean;
  recognitionEmpty: boolean;
  subtextEmpty: boolean;
  logoSrc: string | null;
  signatureSrc: string | null;
};

function SubtextLine({
  fields,
  recipientName,
  empty,
  className = "",
}: {
  fields: Fields;
  recipientName: string;
  empty: boolean;
  className?: string;
}) {
  if (empty) return null;
  const value = resolveSubtext(
    fields.subtext,
    recipientName,
    fields.recognition,
  );
  if (value.trim() === "") return null;
  return (
    <p
      className={`whitespace-pre-wrap break-words text-ink-muted ${className}`}
    >
      {value}
    </p>
  );
}

function OrgMark({
  logoSrc,
  organization,
  className = "",
}: {
  logoSrc: string | null;
  organization: string;
  className?: string;
}) {
  if (logoSrc) {
    return (
      <div className={`flex items-center justify-center gap-3 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt=""
          className="max-h-12 w-auto max-w-[8rem] object-contain"
        />
        <Slot
          value={organization}
          placeholder="Organization"
          className="font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted"
        />
      </div>
    );
  }

  return (
    <Slot
      value={organization}
      placeholder="Organization"
      className={`block font-sans text-xs font-semibold uppercase tracking-widest text-ink-muted ${className}`}
    />
  );
}

function SignatureBlock({
  fields,
  signatureSrc,
  align = "left",
}: {
  fields: Fields;
  signatureSrc: string | null;
  align?: "left" | "right";
}) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  if (signatureSrc) {
    return (
      <div className={`min-w-0 flex-1 ${alignClass}`}>
        <div className="border-b border-ink pb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureSrc}
            alt="Signature"
            className="mx-auto h-10 w-auto max-w-full object-contain object-bottom"
            style={align === "left" ? { marginLeft: 0 } : { marginRight: 0 }}
          />
        </div>
        <Slot
          value={fields.signerTitle}
          placeholder="Title"
          className="mt-1 block font-sans text-xs text-ink-muted"
        />
      </div>
    );
  }

  return (
    <div className={`min-w-0 flex-1 ${alignClass}`}>
      <div className="border-b border-ink pb-1">
        <Slot
          value={fields.signerName}
          placeholder="Signer"
          className="font-serif text-sm font-bold text-ink"
        />
      </div>
      <Slot
        value={fields.signerTitle}
        placeholder="Title"
        className="mt-1 block font-sans text-xs text-ink-muted"
      />
    </div>
  );
}

function ClassicCertificate({
  fields,
  dateDisplay,
  recipientName,
  recipientEmpty,
  subtextEmpty,
  logoSrc,
  signatureSrc,
}: CertificateBaseProps) {
  return (
    <div className="flex h-full flex-col items-center justify-between text-center">
      <div className="w-full">
        <OrgMark logoSrc={logoSrc} organization={fields.organization} />
        <p className="mt-6 font-serif text-sm uppercase tracking-[0.2em] text-ink-muted">
          Certificate of achievement
        </p>
        <p className="mt-4 font-serif text-sm italic text-ink-muted">
          This certifies that
        </p>
        <div className="mt-3 border-b border-ink pb-2">
          <Slot
            value={recipientName}
            placeholder="Recipient name (CSV)"
            className={`font-serif text-2xl font-bold text-ink sm:text-3xl ${
              recipientEmpty ? "" : "break-words"
            }`}
          />
        </div>
        <p className="mt-4 font-serif text-sm italic text-ink-muted">
          has completed
        </p>
        <div className="mt-2">
          <Slot
            value={fields.recognition}
            placeholder="Recognition title"
            className="mt-2 whitespace-pre-wrap font-serif text-lg font-bold text-ink sm:text-xl"
          />
        </div>
        <SubtextLine
          fields={fields}
          recipientName={recipientName}
          empty={subtextEmpty}
          className="mx-auto mt-4 max-w-[36rem] font-sans text-sm leading-6"
        />
      </div>

      <div className="flex w-full items-end justify-between gap-4 text-left">
        <SignatureBlock
          fields={fields}
          signatureSrc={signatureSrc}
          align="left"
        />
        <div className="min-w-0 flex-1 text-right">
          <p className="border-b border-ink pb-1 font-serif text-sm text-ink">
            {dateDisplay || (
              <span className="italic text-ink-muted">Date</span>
            )}
          </p>
          <p className="mt-1 font-sans text-xs text-ink-muted">Date issued</p>
        </div>
      </div>
    </div>
  );
}

function ModernCertificate({
  fields,
  dateDisplay,
  recipientName,
  recipientEmpty,
  recognitionEmpty,
  subtextEmpty,
  logoSrc,
  signatureSrc,
}: CertificateBaseProps) {
  return (
    <div className="flex h-full flex-col text-left">
      <div>
        <div className="flex items-start gap-3">
          {logoSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoSrc}
              alt=""
              className="max-h-12 w-auto max-w-[7rem] shrink-0 object-contain"
            />
          ) : null}
          <Slot
            value={fields.organization}
            placeholder="Organization"
            className="font-sans text-xs font-semibold uppercase tracking-widest text-accent"
          />
        </div>
        <p className="mt-5 font-sans text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Awarded to
        </p>
        <div className="mt-2">
          <Slot
            value={recipientName}
            placeholder="Recipient name (CSV)"
            className={`font-serif text-3xl font-bold leading-tight text-ink ${
              recipientEmpty ? "" : "break-words"
            }`}
          />
        </div>
        <div className="mt-5 border-t border-rule pt-4">
          <Slot
            value={fields.recognition}
            placeholder="Recognition title"
            className={`mt-1 block whitespace-pre-wrap font-sans text-lg font-semibold text-ink ${
              recognitionEmpty ? "" : "break-words"
            }`}
          />
          <SubtextLine
            fields={fields}
            recipientName={recipientName}
            empty={subtextEmpty}
            className="mt-2 text-sm leading-6"
          />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-5">
        <div className="min-w-0 flex-1">
          {signatureSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureSrc}
                alt="Signature"
                className="h-10 w-auto max-w-full object-contain object-bottom"
              />
              <Slot
                value={fields.signerTitle}
                placeholder="Title"
                className="mt-1 block font-sans text-xs text-ink-muted"
              />
            </>
          ) : (
            <>
              <Slot
                value={fields.signerName}
                placeholder="Signer"
                className="block font-sans text-sm font-semibold text-ink"
              />
              <Slot
                value={fields.signerTitle}
                placeholder="Title"
                className="mt-0.5 block font-sans text-xs text-ink-muted"
              />
            </>
          )}
        </div>
        <p className="font-sans text-xs text-ink-muted">
          {dateDisplay || "Date"}
        </p>
      </div>
    </div>
  );
}

function MinimalCertificate({
  fields,
  dateDisplay,
  recipientName,
  recipientEmpty,
  recognitionEmpty,
  subtextEmpty,
  logoSrc,
  signatureSrc,
}: CertificateBaseProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        {logoSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoSrc}
            alt=""
            className="max-h-10 w-auto max-w-[6rem] shrink-0 object-contain"
          />
        ) : null}
        <p className="font-sans text-xs text-ink-muted">
          <Slot value={fields.organization} placeholder="Organization" />
        </p>
      </div>

      <div className="my-auto py-6">
        <Slot
          value={recipientName}
          placeholder="Recipient name (CSV)"
          className={`block font-serif text-2xl font-bold text-ink sm:text-3xl ${
            recipientEmpty ? "" : "break-words"
          }`}
        />
        <div className="mt-3 h-px w-16 bg-ink" />
        <div className="mt-3">
          <Slot
            value={fields.recognition}
            placeholder="Recognition title"
            className={`mt-3 block whitespace-pre-wrap font-sans text-base text-ink ${
              recognitionEmpty ? "" : "break-words"
            }`}
          />
          <SubtextLine
            fields={fields}
            recipientName={recipientName}
            empty={subtextEmpty}
            className="mt-3 text-sm leading-6"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-rule pt-4">
        <div className="min-w-0 flex-1">
          {signatureSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signatureSrc}
                alt="Signature"
                className="h-9 w-auto max-w-full object-contain object-bottom"
              />
              <Slot
                value={fields.signerTitle}
                placeholder="Title"
                className="mt-1 block text-xs text-ink-muted"
              />
            </>
          ) : (
            <>
              <Slot
                value={fields.signerName}
                placeholder="Signer"
                className="block text-sm font-semibold text-ink"
              />
              <Slot
                value={fields.signerTitle}
                placeholder="Title"
                className="mt-0.5 block text-xs text-ink-muted"
              />
            </>
          )}
        </div>
        <p className="text-xs text-ink-muted">{dateDisplay || "Date"}</p>
      </div>
    </div>
  );
}
