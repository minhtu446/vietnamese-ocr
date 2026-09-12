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
preprocess.js              # xử lý ảnh: grayscale, contrast, Otsu, khử nhiễu, đảo nền tối
template.js                # chế độ font: dựng bảng glyph font + đối chiếu từng ký tự
dictionary.js              # chỉnh lỗi chính tả tiếng Việt (an toàn, đúng 1 ký tự)
app.js                     # OCR engine: ensemble 12 pass (Tesseract) + dispatch chế độ font
sound.js                   # hiệu ứng âm thanh (Web Audio API) + nút tắt/bật
ui.js                      # móc nối sự kiện giao diện (upload, font, kết quả)
index.html                 # giao diện chính
style.css                  # giao diện sáng hiện đại
```

## Hai chế độ nhận diện

1. **Tesseract (tự động)** — chạy 12 lần với nhiều biến thể ảnh (tương phản, nhị phân,
   làm sạch, ngưỡng thấp/cao...) và nhiều PSM; tự chọn kết quả tốt nhất. Xử lý đa số ảnh.
2. **Theo font (chính xác với chữ 3D/trang trí)** — nhấn "Tải font (.ttf)" và cung cấp
   font mà nội dung trong ảnh sử dụng. Ứng dụng dựng bảng glyph từ font đó, cắt từng ký tự
   và đối chiếu để nhận diện (đặc biệt hữu ích với font 3D, bevel, bóng đổ).