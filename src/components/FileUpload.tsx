import { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { extractEpub } from '../lib/epub';

interface FileUploadProps {
  onFileProcessed: (content: string, title: string, fileName: string, fileType: string) => void;
}

export default function FileUpload({ onFileProcessed }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ACCEPTED_TYPES = ['pdf', 'txt', 'epub', 'md', 'html'];

  const processFile = useCallback(async (file: File) => {
    setProcessing(true);
    setError(null);

    try {
      const parts = file.name.split('.');
      const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';

      if (!ext || !ACCEPTED_TYPES.includes(ext)) {
        throw new Error(`Format nicht unterstützt: .${ext}. Erlaubt: ${ACCEPTED_TYPES.map(e => `.${e}`).join(', ')}`);
      }

      let content = '';
      let title = file.name.replace(/\.[^.]+$/, '');

      if (ext === 'txt' || ext === 'md') {
        content = await file.text();
      } else if (ext === 'html') {
        const text = await file.text();
        const temp = document.createElement('div');
        temp.innerHTML = text;
        content = temp.textContent || temp.innerText || text;
      } else if (ext === 'pdf') {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .filter((item: any) => 'str' in item && item.str)
            .map((item: any) => item.str)
            .join(' ');
          text += pageText + '\n';
        }
        content = text;

        if (!content.trim()) {
          throw new Error('PDF enthält keinen extrahierbaren Text. Eventuell ein Scan?');
        }
      } else if (ext === 'epub') {
        const epubMeta = await extractEpub(file);
        content = epubMeta.content;
        if (epubMeta.title && epubMeta.title !== 'Unbekannter Titel') {
          title = epubMeta.title;
        }
      }

      if (content.trim().length === 0) {
        throw new Error('Datei enthält keinen lesbaren Text.');
      }

      onFileProcessed(content.trim(), title, file.name, ext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Verarbeiten');
    } finally {
      setProcessing(false);
    }
  }, [onFileProcessed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !processing && document.getElementById('file-input')?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          dragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : processing
              ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 cursor-wait'
              : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'
        }`}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf,.txt,.epub,.md,.html"
          onChange={handleFileInput}
          className="hidden"
          disabled={processing}
        />
        {processing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Datei wird verarbeitet...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Dateien hierher ziehen</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                oder <span className="text-indigo-600 dark:text-indigo-400 underline">durchsuchen</span>
              </p>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap justify-center">
              {ACCEPTED_TYPES.map(ext => (
                <span key={ext} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400 uppercase">
                  .{ext}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Info */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">So funktioniert's</p>
            <ul className="text-sm text-gray-500 dark:text-gray-400 mt-2 space-y-1">
              <li>• PDF, TXT, EPUB, MD Dateien hochladen</li>
              <li>• Text wird automatisch extrahiert</li>
              <li>• TTS liest vor — wie ein Hörbuch 🎧</li>
              <li>• Alles lokal auf dem Gerät gespeichert</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
