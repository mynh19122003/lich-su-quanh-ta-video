# Lịch Sử Quanh Ta: video lịch sử vẽ tay

Dự án làm video lịch sử Việt Nam kiểu hoạt hình vẽ tay (người que, chữ viết tay, bản đồ, ảnh tư liệu), dựng bằng [Remotion](https://www.remotion.dev), kèm một trình dựng video chạy trên máy và các công cụ đăng TikTok.

## Có gì trong repo

| Thư mục | Nội dung |
|---|---|
| `src/` | Video Remotion: video 51 giây chữ viết tay (`HistoryVideo`), tập 1 Hiệp định Giơnevơ (`src/geneva/`), và bộ dựng dự án của trình dựng (`src/project/`, gồm nhân vật vẽ tay, ảnh tư liệu) |
| `editor/` | Trình dựng video kiểu CapCut (`npm run editor`): timeline, giọng AI, tạo tập từ kịch bản, tách cảnh, phụ đề tự động, gửi bản nháp TikTok và lịch gửi mỗi ngày |
| `kich-ban/` | Kịch bản các tập (`tap-2-…`, `tap-3-…`) và tư liệu đã kiểm chứng (`kich-ban/research/`) |
| `projects/` | Các dự án của trình dựng (tập 1, 2, 3, các clip dọc cho TikTok) |
| `projects-parts/` | Cách cắt một tập dọc thành các clip TikTok |
| `scripts/` | Script Python và Node: giọng đọc, nhạc, ảnh tư liệu, cắt clip dọc, chuẩn âm lượng |
| `public/` | Font, giọng đọc đã tạo, nhạc, ảnh tư liệu (phạm vi công cộng, nguồn ở `public/photos/*/credits.json`) |
| `.claude/skills/` | Các skill của Claude Code dùng cho dự án (Remotion, kể chuyện, hài, TikTok, nghiên cứu tư liệu, hiệu ứng âm thanh…) |
| `docs/tiktok/` | Trang Điều khoản và Quyền riêng tư của app TikTok |

## Cài trên macOS

```bash
# 1. Công cụ cần có
brew install node python ffmpeg

# 2. Thư viện Node (Remotion tự tải bản ffmpeg cho Mac)
npm install

# 3. Thư viện Python (giọng đọc, phụ đề, tách giọng)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Trình dựng tự tìm Python (`python`, `py`, `python3`). Nếu dùng môi trường ảo, chạy trình dựng trong cùng cửa sổ đã `source .venv/bin/activate`, hoặc đặt `PYTHON=$(pwd)/.venv/bin/python`.

## Cài trên Windows

Mở **PowerShell** (không cần quyền Administrator):

```powershell
# 1. Công cụ cần có (đóng rồi mở lại PowerShell sau bước này để nhận PATH mới)
winget install Git.Git OpenJS.NodeJS.LTS Python.Python.3.12 Gyan.FFmpeg

# 2. Lấy mã nguồn
git clone https://github.com/mynh19122003/lich-su-quanh-ta-video.git
cd lich-su-quanh-ta-video

# 3. Thư viện Node (Remotion tự tải bản ffmpeg cho Windows)
npm install

# 4. Thư viện Python
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Chạy trình dựng với Python của môi trường ảo (không cần `Activate.ps1`, nên không phải đổi Execution Policy):

```powershell
$env:PYTHON = "$PWD\.venv\Scripts\python.exe"
npm run editor
```

Lưu ý trên Windows:

- Các lệnh `python3 scripts/…` ở phần dưới, trên Windows gõ `.venv\Scripts\python.exe scripts\…` (hoặc `py scripts\…` nếu cài thư viện thẳng vào Python chung).
- Nếu chữ tiếng Việt in ra cửa sổ bị lỗi, chạy `chcp 65001` trước, hoặc đặt `$env:PYTHONUTF8 = "1"`.
- `torch` (cho phụ đề tự động và tách giọng) khá nặng, khoảng 200 MB trở lên. Nếu chỉ cần giọng đọc và xuất video, có thể bỏ 3 dòng cuối trong `requirements.txt`.
- Giữ đường dẫn thư mục dự án không quá sâu (ví dụ `D:\Code\Video`) để tránh lỗi đường dẫn dài của Windows khi `npm install`.

## Chạy

```bash
npm run editor      # trình dựng: http://localhost:3100 (kịch bản: /script)
npm run dev         # Remotion Studio: xem trước các video trong src/
```

Xuất video: trong trình dựng bấm **Xuất video**. File nằm trong `out/` (không đưa lên git).

## TikTok

Khóa app TikTok và phiên đăng nhập nằm trong `.tiktok/`, **không** có trong repo. Trên máy mới:

1. Mở trình dựng, bấm **📤 TikTok**, dán lại Client Key và Client Secret của app.
2. Bấm **Kết nối tài khoản TikTok** và đăng nhập lại.
3. Lịch gửi bản nháp mỗi ngày phải bật lại trên máy mới (mục 5 trong hộp TikTok).

Xem thêm [TIKTOK.md](TIKTOK.md).

## Làm một tập mới

1. Nghiên cứu tư liệu: dùng skill `research`, ghi vào `kich-ban/research/`.
2. Viết kịch bản trong `kich-ban/` theo định dạng của trình dựng (`# Tên cảnh | nền: … | nhân vật: …`, mỗi dòng `Người nói: câu thoại`, ảnh tư liệu bằng dòng `Ảnh: photos/… | chú thích`).
3. Đọc giọng trước cho nhanh: `python3 scripts/voice_script.py kich-ban/<file>.txt` (trình dựng phải đang chạy).
4. Trong trình dựng: **Tập phim → Tạo tập từ kịch bản**, chọn khung 16:9 hoặc 9:16.
5. Cắt bản dọc thành clip TikTok: viết một file như `projects-parts/tap-3-parts.json`, rồi `python3 scripts/cut_vertical_parts.py projects-parts/<file>.json`.
