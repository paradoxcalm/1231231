# -*- coding: utf-8 -*-
"""Flask-сервер для приёма заданий на печать."""
import os
import logging
import subprocess
import tempfile
import threading
from typing import Optional

from flask import Flask, request, jsonify
from PyPDF2 import PdfReader, PdfWriter

try:
    import win32print
except ImportError:  # pragma: no cover - модуль доступен только под Windows
    win32print = None

ADOBE_READER_PATH = os.environ.get(
    "PRINT_ADOBE_READER",
    r"C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe",
)
FONT_PATH = os.environ.get("PRINT_FONT_PATH", r"C:\Windows\Fonts\arial.ttf")
DEFAULT_TEXT_ENCODING = os.environ.get("PRINT_TEXT_ENCODING", "utf-8")

PRINT_SERVER_TOKEN = os.environ.get("PRINT_SERVER_TOKEN", "changeme")

logging.basicConfig(
    filename="log.txt",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logging.info("=== Запуск сервера печати ===")

selected_printer = None
selected_orientation = 1  # 1 = книжная, 2 = альбомная

app = Flask(__name__)


def rotate_pdf(input_pdf, output_pdf, degrees=90):
    try:
        reader = PdfReader(input_pdf)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page.rotate(degrees))
        with open(output_pdf, 'wb') as f:
            writer.write(f)
        return True
    except Exception as e:
        logging.error(f"Ошибка при повороте PDF: {e}")
        return False


def print_pdf_via_acrobat(file_path, printer_name):
    try:
        args = [ADOBE_READER_PATH, "/h", "/t", file_path, printer_name]
        process = subprocess.Popen(args, creationflags=subprocess.CREATE_NO_WINDOW)
        logging.info(
            "Отправлен файл '%s' на принтер '%s' через Acrobat", os.path.basename(file_path), printer_name
        )
        process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        logging.warning("Acrobat долго печатает, продолжаем работу...")
    except Exception as e:
        logging.error(f"Ошибка при печати через Acrobat: {e}")


def str_to_bool(value: Optional[str]) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def print_raw_text(text: str, printer_name: str, encoding: str, auto_cut: bool = False):
    if not win32print:
        raise RuntimeError("Библиотека win32print недоступна. Запустите сервер под Windows.")
    try:
        data = text.encode(encoding or DEFAULT_TEXT_ENCODING)
    except LookupError:
        logging.warning("Неизвестная кодировка '%s', используется UTF-8", encoding)
        data = text.encode("utf-8")

    if auto_cut:
        # Команда полного отреза для ESC/POS-принтеров
        data += b"\x1d\x56\x42\x00"

    hPrinter = win32print.OpenPrinter(printer_name)
    try:
        hJob = win32print.StartDocPrinter(hPrinter, 1, ("Remote text job", None, "RAW"))
        try:
            win32print.StartPagePrinter(hPrinter)
            win32print.WritePrinter(hPrinter, data)
            win32print.EndPagePrinter(hPrinter)
            logging.info("Отправлен текст на принтер '%s' (%d байт)", printer_name, len(data))
        finally:
            win32print.EndDocPrinter(hPrinter)
    finally:
        win32print.ClosePrinter(hPrinter)


@app.route('/print/file', methods=['POST'])
def print_file():
    global selected_printer, selected_orientation
    token = request.headers.get('X-Auth-Token')
    if token != PRINT_SERVER_TOKEN:
        return jsonify({'success': False, 'message': 'Недопустимый токен'}), 403
    if not selected_printer:
        return jsonify({'success': False, 'message': 'Принтер не выбран'}), 400
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Файл не найден'}), 400
    f = request.files['file']
    if f.filename == '' or not f.filename.lower().endswith('.pdf'):
        return jsonify({'success': False, 'message': 'Требуется PDF-файл'}), 400
    rotated = None
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    try:
        f.save(temp_file.name)
        file_to_print = temp_file.name
        if selected_orientation == 2:
            rotated = temp_file.name.replace('.pdf', '_landscape.pdf')
            if rotate_pdf(temp_file.name, rotated, degrees=90):
                file_to_print = rotated
            else:
                return jsonify({'success': False, 'message': 'Не удалось повернуть PDF'}), 500
        print_pdf_via_acrobat(file_to_print, selected_printer)
        return jsonify({'success': True, 'message': 'Печать начата'})
    finally:
        temp_file.close()
        for path in filter(None, [temp_file.name, rotated]):
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                logging.warning(f"Не удалось удалить временный файл {path}: {e}")


@app.route('/print/text', methods=['POST'])
def print_text():
    global selected_printer, selected_orientation
    token = request.headers.get('X-Auth-Token')
    if token != PRINT_SERVER_TOKEN:
        return jsonify({'success': False, 'message': 'Недопустимый токен'}), 403
    if not selected_printer:
        return jsonify({'success': False, 'message': 'Принтер не выбран'}), 400
    text = request.form.get('text', '').strip()
    if not text:
        return jsonify({'success': False, 'message': 'Текст пустой'}), 400
    encoding = request.form.get('encoding', DEFAULT_TEXT_ENCODING)
    need_cut = str_to_bool(request.form.get('cut'))

    try:
        print_raw_text(text, selected_printer, encoding=encoding, auto_cut=need_cut)
    except Exception as e:
        logging.error("Ошибка при печати текста: %s", e)
        return jsonify({'success': False, 'message': 'Не удалось отправить текст на печать'}), 500

    return jsonify({'success': True, 'message': 'Печать начата'})


def start_server():
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)


if __name__ == '__main__':
    import tkinter as tk
    from tkinter import ttk, messagebox

    def on_start_server():
        global selected_printer, selected_orientation
        btn_start.config(state=tk.DISABLED)
        selected_printer = printer_combo.get()
        if not selected_printer:
            messagebox.showwarning('Принтер не выбран', 'Выберите принтер перед запуском.')
            btn_start.config(state=tk.NORMAL)
            return
        orientation = orientation_combo.get()
        selected_orientation = 2 if orientation == 'Альбомная' else 1
        threading.Thread(target=start_server, daemon=True).start()
        messagebox.showinfo('Сервер запущен', 'Сервер печати запущен и готов принимать задания.')

    root = tk.Tk()
    root.title('Сервер печати PDF')
    root.geometry('400x200')
    root.resizable(False, False)

    tk.Label(root, text='Принтер:').pack(pady=(10, 0))
    printers = []
    names = []
    default = None
    if win32print:
        printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
        names = [p[2] for p in printers]
        try:
            default = win32print.GetDefaultPrinter()
        except Exception:
            default = None
    if default and default not in names:
        names.insert(0, default)
    printer_combo = ttk.Combobox(root, values=names, state='readonly')
    if default:
        printer_combo.set(default)
    printer_combo.pack(pady=5, fill=tk.X, padx=20)

    tk.Label(root, text='Ориентация:').pack(pady=(10, 0))
    orientation_combo = ttk.Combobox(root, values=['Альбомная', 'Книжная'], state='readonly')
    orientation_combo.set('Альбомная')
    orientation_combo.pack(pady=5, fill=tk.X, padx=20)

    btn_start = tk.Button(root, text='Запустить сервер', command=on_start_server, bg='#4CAF50', fg='white')
    btn_start.pack(pady=20)

    root.mainloop()
