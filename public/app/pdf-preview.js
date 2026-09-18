/* On-demand PDF page snapshots. Every PDF and decoder resource stays same-origin. */
'use strict';
(() => {
  let library;
  const text = (ko, en) => lang === 'ko' ? ko : en;
  const label = () => text('PDF 페이지 이미지 추출', 'Extract PDF page image');
  const current = () => session?.user?.role === 'pm' && route?.role === 'pm' && route?.tab === 'designs'
    ? items('designs').find(item => item.id === route.item && /\.pdf$/i.test(item.fileName || '')) : null;

  function install() {
    if (!current() || document.getElementById('extract-pdf-page')) return;
    const addPreview = document.querySelector('[data-action="add-preview"]');
    if (!addPreview) return;
    const button = document.createElement('button');
    button.id = 'extract-pdf-page';
    button.type = 'button';
    button.className = 'button';
    button.textContent = label();
    button.addEventListener('click', show);
    addPreview.insertAdjacentElement('afterend', button);
  }

  function show() {
    const source = current();
    if (!source) return;
    const sourceId = source.id, sourceVersion = source.version, sourceData = source.data;
    const changed = () => !current() || current().id !== sourceId ||
      current().version !== sourceVersion || current().data !== sourceData;
    openDialog(label(), `<label class="field full">${esc(text('페이지 번호', 'Page number'))}<input name="page" type="number" min="1" step="1" value="1" required></label><p class="small muted full">${esc(text('선택한 페이지를 최대 2000px PNG로 저장합니다. 기존 비교 이미지는 유지됩니다. 암호가 걸린 PDF는 추출할 수 없습니다.', 'Save the selected page as a PNG up to 2000px. Existing comparison images are preserved. Password-protected PDFs cannot be extracted.'))}</p><p class="small full" id="pdf-extract-status" role="status" aria-live="polite"></p>`, async form => {
      const pageNumber = Number(form.get('page'));
      if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) throw Error(text('1 이상의 정수 페이지 번호를 입력하세요.', 'Enter a whole page number of 1 or greater.'));
      if (changed()) throw Error(text('도안이 변경되었습니다. 최신 도안을 다시 열어 주세요.', 'The drawing changed. Reopen the latest drawing.'));
      // Only authorized app file URLs are accepted; PDF links never select an external source.
      if (typeof sourceData !== 'string' || !/^\/api\/files\/[a-zA-Z0-9_-]+$/.test(sourceData)) throw Error(text('이 도안의 PDF 원본을 열 수 없습니다.', 'The original PDF is unavailable.'));
      const dialog = document.getElementById('dialog');
      const status = document.getElementById('pdf-extract-status');
      const buttons = [...dialog.querySelectorAll('[data-close]')];
      const input = dialog.querySelector('[name="page"]');
      const preventCancel = event => event.preventDefault();
      buttons.forEach(button => { button.disabled = true; });
      input.disabled = true;
      dialog.setAttribute('aria-busy', 'true');
      dialog.addEventListener('cancel', preventCancel);
      let task, pdf, canvas;
      try {
        status.textContent = text('PDF를 불러오는 중…', 'Loading PDF…');
        library ??= import('./vendor/pdf.mjs').catch(error => { library = null; throw error; });
        const pdfjs = await library;
        pdfjs.GlobalWorkerOptions.workerSrc = '/app/vendor/pdf.worker.mjs';
        task = pdfjs.getDocument({
          url: sourceData,
          isEvalSupported: false,
          enableXfa: false,
          cMapUrl: '/app/vendor/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/app/vendor/standard_fonts/',
          wasmUrl: '/app/vendor/wasm/',
          iccUrl: '/app/vendor/iccs/',
          useWasm: true,
          stopAtErrors: true,
          canvasMaxAreaInBytes: 32 * 1024 * 1024
        });
        pdf = await task.promise;
        input.max = String(pdf.numPages);
        if (pageNumber > pdf.numPages) throw Error(text(`이 PDF는 ${pdf.numPages}페이지입니다. 1~${pdf.numPages} 사이를 입력하세요.`, `This PDF has ${pdf.numPages} pages. Enter a page from 1 to ${pdf.numPages}.`));
        status.textContent = text(`${pageNumber} / ${pdf.numPages}페이지 이미지 생성 중…`, `Rendering page ${pageNumber} of ${pdf.numPages}…`);
        const page = await pdf.getPage(pageNumber);
        const natural = page.getViewport({ scale: 1 });
        if (!(natural.width > 0 && natural.height > 0 && Number.isFinite(natural.width) && Number.isFinite(natural.height))) throw Error(text('PDF 페이지 크기가 올바르지 않습니다.', 'The PDF page dimensions are invalid.'));
        const viewport = page.getViewport({ scale: 2000 / Math.max(natural.width, natural.height) });
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.min(2000, Math.ceil(viewport.width)));
        canvas.height = Math.max(1, Math.min(2000, Math.ceil(viewport.height)));
        const canvasContext = canvas.getContext('2d', { alpha: false });
        if (!canvasContext) throw Error(text('브라우저에서 이미지 생성을 지원하지 않습니다.', 'This browser cannot create the page image.'));
        await page.render({ canvasContext, viewport, background: 'rgb(255,255,255)' }).promise;
        const data = canvas.toDataURL('image/png');
        if (!data.startsWith('data:image/png;base64,')) throw Error(text('페이지 이미지를 만들 수 없습니다.', 'The page image could not be created.'));
        if (changed()) throw Error(text('도안이 변경되었습니다. 최신 도안을 다시 열어 주세요.', 'The drawing changed. Reopen the latest drawing.'));
        status.textContent = text('이미지를 저장하는 중…', 'Saving page image…');
        const next = structuredClone(db);
        const item = next.items.find(record => record.id === sourceId);
        (item.previews ??= []).push({ id: id(), title: `${item.fileName} / p.${pageNumber}`, data });
        await saveDB(next);
        dialog.close();
        render();
        toast(t('saved'));
      } catch (error) {
        if (error.name === 'PasswordException') throw Error(text('암호로 보호된 PDF입니다. 암호가 없는 사본이나 PNG 미리보기를 등록해 주세요.', 'This PDF is password-protected. Upload an unlocked copy or a PNG preview.'));
        if (error.name === 'InvalidPDFException' || error.name === 'FormatError') throw Error(text('PDF가 손상되었거나 지원하지 않는 형식입니다. 원본을 확인하거나 PNG 미리보기를 등록해 주세요.', 'The PDF is invalid or unsupported. Check the original or upload a PNG preview.'));
        if (error.name === 'MissingPDFException' || error.name === 'UnexpectedResponseException') throw Error(text('PDF를 불러올 수 없습니다. 접근 권한과 연결을 확인해 주세요.', 'The PDF could not be loaded. Check access and connectivity.'));
        throw error;
      } finally {
        status.textContent = '';
        buttons.forEach(button => { button.disabled = false; });
        input.disabled = false;
        dialog.removeAttribute('aria-busy');
        dialog.removeEventListener('cancel', preventCancel);
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        // Cleanup errors must not turn a successful save into an apparent failure.
        try { if (task) await task.destroy(); } catch (_) {}
      }
    });
  }
  window.addEventListener('workspace-render', install);
  install();
})();
