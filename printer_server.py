# -*- coding: utf-8 -*-
"""Flask-сервер для приёма заданий на печать."""
import os
import logging
import subprocess
from flask import Flask, request, jsonify
from PyPDF2 import PdfReader, PdfWriter
from fpdf import FPDF
import threading

ADOBE_READER_PATH = r"C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe"
FONT_PATH = r"C:\Windows\Fonts\arial.ttf"

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
    save_path = os.path.join(os.getcwd(), f.filename)
    rotated = None
    try:
        f.save(save_path)
        file_to_print = save_path
        if selected_orientation == 2:
            rotated = save_path.replace('.pdf', '_landscape.pdf')
            if rotate_pdf(save_path, rotated, degrees=90):
                file_to_print = rotated
            else:
                return jsonify({'success': False, 'message': 'Не удалось повернуть PDF'}), 500
        print_pdf_via_acrobat(file_to_print, selected_printer)
        return jsonify({'success': True, 'message': 'Печать начата'})
    finally:
        for path in filter(None, [save_path, rotated]):
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
    pdf_path = os.path.join(os.getcwd(), 'text_print.pdf')
    rotated = None
    try:
        try:
            pdf = FPDF()
            pdf.add_font('Arial', '', FONT_PATH, uni=True)
            pdf.set_font('Arial', size=12)
            pdf.add_page()
            for line in text.splitlines():
                pdf.multi_cell(0, 10, line)
            pdf.output(pdf_path)
        except Exception as e:
            logging.error(f"Ошибка при создании PDF: {e}")
            return jsonify({'success': False, 'message': 'Не удалось сформировать PDF'}), 500
        file_to_print = pdf_path
        if selected_orientation == 2:
            rotated = pdf_path.replace('.pdf', '_landscape.pdf')
            if rotate_pdf(pdf_path, rotated, degrees=90):
                file_to_print = rotated
            else:
                return jsonify({'success': False, 'message': 'Не удалось повернуть PDF'}), 500
        print_pdf_via_acrobat(file_to_print, selected_printer)
        return jsonify({'success': True, 'message': 'Печать начата'})
    finally:
        for path in filter(None, [pdf_path, rotated]):
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                logging.warning(f"Не удалось удалить временный файл {path}: {e}")


def start_server():
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)


if __name__ == '__main__':
    import tkinter as tk
    from tkinter import ttk, messagebox
    import win32print

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
    printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
    names = [p[2] for p in printers]
    default = win32print.GetDefaultPrinter()
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
