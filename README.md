# Vietnamese OCR — Web App

Ứng dụng web nhận diện chữ tiếng Việt (OCR) chạy hoàn toàn trong trình duyệt.

- **Công nghệ**: HTML/CSS/JS thuần + [Tesseract.js](https://github.com/naptha/tesseract.js) (WebAssembly)
- **Ngôn ngữ nhận diện**: Tiếng Việt (`vie.traineddata`)
- **Deploy**: GitHub Pages — không cần server, không cần backend

## Cách dùng

1. Tải ảnh có chứa chữ tiếng Việt lên (drag & drop hoặc chọn file).
2. Chờ quá trình nhận diện hoàn tất.
3. Nhận kết quả text đã trích xuất + mức độ tin cậy, copy 1 chạm.

## Chạy cục bộ

```bash
# Cách đơn giản nhất: mở trực tiếp index.html
# Hoặc dùng một local server tĩnh, ví dụ:
python -m http.server 8000
# rồi mở http://localhost:8000
```

## Cấu trúc

```
tessdata/vie.traineddata   # ngôn ngữ tiếng Việt cho Tesseract
app.js                     # logic OCR (Tesseract worker)
index.html                 # giao diện chính
style.css                  # giao diện sáng hiện đại
```