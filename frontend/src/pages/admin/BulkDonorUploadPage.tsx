import { ChangeEvent, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import api from '../../lib/api';

type BulkDonorRecord = {
  phone_number?: string;
  name?: string;
  password?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  gothra?: string;
  tamil_star?: string;
  rasi?: string;
  date_of_birth?: string;
  family_name?: string;
  notes?: string;
  gender?: string;
  tamil_name?: string;
};

type ParsedRecord = {
  rowIndex: number;
  data: BulkDonorRecord;
  errors: string[];
};

type UploadStatus = 'created' | 'updated' | 'failed';

type UploadResult = {
  row: number;
  phone_number?: string;
  status: UploadStatus;
  password?: string;
  errors?: unknown;
};

type UploadResponse = {
  created_count: number;
  updated_count: number;
  failed_count: number;
  results: UploadResult[];
};

const TEMPLATE_COLUMNS: Array<keyof BulkDonorRecord> = [
  'phone_number',
  'name',
  'password',
  'email',
  'address_line1',
  'address_line2',
  'address_line3',
  'city',
  'state',
  'postal_code',
  'gothra',
  'tamil_star',
  'rasi',
  'date_of_birth',
  'family_name',
  'gender',
  'tamil_name',
  'notes',
];

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const BulkDonorUploadPage = () => {
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('');

  const headerLookup = useMemo(() => {
    const map = new Map<string, keyof BulkDonorRecord>();
    TEMPLATE_COLUMNS.forEach((column) => {
      map.set(normalizeHeader(column), column);
    });
    return map;
  }, []);

  const readyRecords = useMemo(
    () => parsedRecords.filter((record) => record.errors.length === 0),
    [parsedRecords],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage('');
    setUploadResponse(null);
    setSelectedFileName(file.name);

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const buffer = loadEvent.target?.result;
        if (!buffer) {
          throw new Error('Unable to read file.');
        }

        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) {
          throw new Error('Please select a file with at least one worksheet.');
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        const parsed = rows.map((row, index) => {
          const normalized: BulkDonorRecord = {};
          Object.entries(row).forEach(([rawKey, rawValue]) => {
            const normalizedKey = normalizeHeader(rawKey ?? '');
            const columnKey = headerLookup.get(normalizedKey);
            if (!columnKey) return;

            const value =
              rawValue instanceof Date
                ? rawValue.toISOString().split('T')[0]
                : typeof rawValue === 'number'
                ? String(rawValue)
                : rawValue;

            const trimmedValue = typeof value === 'string' ? value.trim() : String(value).trim();
            if (trimmedValue) {
              normalized[columnKey] = trimmedValue;
            }
          });

          const errors: string[] = [];
          if (!normalized.phone_number) {
            errors.push('Phone number is required.');
          }
          if (!normalized.name) {
            errors.push('Name is required.');
          }
          return {
            rowIndex: index + 2,
            data: normalized,
            errors,
          };
        });

        const duplicates = new Map<string, number>();
        parsed.forEach((record) => {
          const normalizedPhone = record.data.phone_number?.replace(/\D/g, '') ?? '';
          if (!normalizedPhone) return;
          duplicates.set(normalizedPhone, (duplicates.get(normalizedPhone) ?? 0) + 1);
        });

        const deduped = parsed.map((record) => {
          const errors = [...record.errors];
          const normalizedPhone = record.data.phone_number?.replace(/\D/g, '') ?? '';
          if (normalizedPhone && (duplicates.get(normalizedPhone) ?? 0) > 1) {
            errors.push('Duplicate phone number found in file.');
          }
          return { ...record, errors };
        });

        setParsedRecords(deduped);
      } catch (error) {
        setParsedRecords([]);
        setErrorMessage((error as Error).message || 'Failed to parse file.');
      }
    };

    reader.onerror = () => {
      setErrorMessage('Unable to read the selected file.');
      setParsedRecords([]);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async () => {
    if (readyRecords.length === 0) return;
    setIsUploading(true);
    setUploadResponse(null);
    setErrorMessage('');

    const payload = {
      records: readyRecords.map((record) => ({ ...record.data, source_row: record.rowIndex })),
      default_password: defaultPassword.trim(),
    };

    try {
      const { data } = await api.post<UploadResponse>('/auth/bulk-register/', payload);
      setUploadResponse(data);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ??
        error?.response?.data?.error ??
        error?.message ??
        'Unable to upload records.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateRow = TEMPLATE_COLUMNS.reduce<Record<string, string>>((acc, column) => {
      acc[column] = '';
      return acc;
    }, {});
    const worksheet = XLSX.utils.json_to_sheet([templateRow], { header: TEMPLATE_COLUMNS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Donors');
    XLSX.writeFile(workbook, 'donor-upload-template.xlsx');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-500">Admin Operations</p>
          <h1 className="text-3xl font-bold text-slate-900">Bulk Donor Upload</h1>
        </div>
        <p className="max-w-3xl text-sm text-slate-600">
          Prepare an Excel file with donor information and upload it here. Only the required columns will be processed,
          and any invalid rows will be highlighted for review.
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-full border border-dashed border-orange-300 bg-orange-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-orange-600">
            Required columns: phone_number, name
          </span>
          <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Optional columns: password, email, gothra, tamil_star, rasi, family_name, notes
          </span>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Import file</h2>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-600 transition hover:border-orange-300 hover:text-orange-700"
            >
              Download template
            </button>
          </div>
          <p className="text-sm text-slate-500">
            The template contains the column headers the importer understands. You can rename the headers as long as they
            match the normalized field names (spaces and case are ignored).
          </p>

          <label
            htmlFor="donor-upload"
            className="mt-6 flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center"
          >
            <span className="text-sm font-semibold text-slate-700">Select an Excel (.xlsx/.xls/.csv) file</span>
            <span className="text-xs text-slate-500">Drop it here or browse</span>
            <span className="text-xs text-slate-400">{selectedFileName || 'No file selected'}</span>
            <input
              id="donor-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>

          <div className="mt-4 space-y-2 text-xs text-slate-500">
            <p>Default password (optional):</p>
            <input
              type="text"
              value={defaultPassword}
              onChange={(event) => setDefaultPassword(event.target.value)}
              placeholder="Leave blank to auto-generate"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-300 focus:border-orange-400 focus:outline-none"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Parsed records</h2>
          <p className="text-sm text-slate-500">
            {parsedRecords.length} rows detected, {readyRecords.length} ready for upload.
          </p>
          <div className="mt-4 space-y-3">
            {parsedRecords.slice(0, 4).map((record) => (
              <div key={record.rowIndex} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>Row {record.rowIndex}</span>
                  <span>{record.data.phone_number || '—'}</span>
                </div>
                <p className="text-xs text-slate-500">{record.data.name || 'No name provided'}</p>
                {record.errors.length > 0 ? (
                  <ul className="mt-2 text-xs text-rose-500">
                    {record.errors.map((error, errorIndex) => (
                      <li key={`${record.rowIndex}-${errorIndex}`}>{error}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-emerald-600">Valid</p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={readyRecords.length === 0 || isUploading}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-orange-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUploading ? 'Uploading…' : 'Upload valid rows'}
          </button>
          {errorMessage && <p className="mt-3 text-xs text-rose-500">{errorMessage}</p>}
        </section>
      </div>

      {uploadResponse && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Upload summary</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {uploadResponse.created_count} created · {uploadResponse.updated_count} updated · {uploadResponse.failed_count} failed
            </span>
          </div>
          <div className="grid gap-3">
            {uploadResponse.results.map((result) => {
              const isSuccess = result.status === 'created' || result.status === 'updated';
              const statusLabel =
                result.status === 'created' ? 'Created' : result.status === 'updated' ? 'Updated' : 'Failed';
              return (
                <div
                  key={`${result.row}-${result.phone_number}-${result.status}`}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between text-slate-700">
                    <span>
                      Row {result.row} · {result.phone_number || 'Unknown phone'}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  {result.password && (
                    <p className="text-xs text-slate-600">
                      Password: <span className="font-semibold text-slate-900">{result.password}</span>
                    </p>
                  )}
                  {result.errors && (
                    <pre className="whitespace-pre-wrap rounded-xl bg-white/80 p-2 text-xs text-rose-600">
                      {JSON.stringify(result.errors)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default BulkDonorUploadPage;
