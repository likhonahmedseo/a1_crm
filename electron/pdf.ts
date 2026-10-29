import { BrowserWindow, dialog, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export async function htmlToPdf(html: string, suggestedName: string): Promise<{ ok: boolean; filePath?: string }> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      sandbox: true,
    },
  });

  try {
    await win.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(html)
    );
    // Allow webfonts/images time to render
    await new Promise((r) => setTimeout(r, 250));

    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });

    const result = await dialog.showSaveDialog({
      title: 'Save PDF',
      defaultPath: path.join(app.getPath('documents'), suggestedName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) return { ok: false };
    fs.writeFileSync(result.filePath, pdf);
    return { ok: true, filePath: result.filePath };
  } finally {
    win.destroy();
  }
}
