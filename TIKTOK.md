# Kết nối trình dựng với TikTok

Trình dựng gửi video đã xuất vào **hộp thư TikTok** của bạn dưới dạng bản nháp. Bạn mở app TikTok, dán tiêu đề (đã được sao chép sẵn) rồi bấm Đăng.

Để làm được việc này, TikTok yêu cầu bạn có một "ứng dụng nhà phát triển" miễn phí. Bạn chỉ cần làm một lần.

## 1. Tạo ứng dụng trên TikTok for Developers

1. Vào <https://developers.tiktok.com> và đăng nhập bằng tài khoản TikTok của bạn.
2. Chọn **Manage apps** → **Connect an app** (hoặc **Create app**). Đặt tên, ví dụ "Trình dựng video của tôi", rồi chọn loại cá nhân hoặc tổ chức.
3. Trong trang của app, mục **Products**, thêm 2 sản phẩm:
   - **Login Kit**
   - **Content Posting API**
4. Trong **Login Kit**:
   - Chọn nền tảng **Desktop**.
   - Ở ô **Redirect URI**, thêm đúng địa chỉ sau (có dấu `/` ở cuối):

     ```
     http://localhost:3100/tiktok/callback/
     ```

5. Trong **Content Posting API**, bật phần **Upload** (đăng bản nháp). Không cần bật Direct Post.
6. Trong mục **Scopes**, đảm bảo có `user.info.basic` và `video.upload`.

Tên các mục trên trang TikTok có thể thay đổi một chút theo thời gian, nhưng các bước chính vẫn như trên.

## 2. Dùng thử ngay bằng Sandbox (không cần chờ TikTok duyệt)

App mới tạo phải được TikTok xét duyệt thì người khác mới dùng được. Nếu chỉ đăng lên tài khoản của chính bạn, hãy dùng **Sandbox**:

1. Trong trang app, chuyển sang **Sandbox** và tạo một sandbox.
2. Ở **Target users** (người dùng thử), thêm tài khoản TikTok bạn muốn đăng video lên.
3. Trong sandbox, làm lại bước 3–6 ở trên: thêm sản phẩm, Redirect URI và scope.
4. Sandbox có **Client Key** và **Client Secret** riêng, bạn dùng bộ khoá này.

Khi muốn dùng chính thức, bấm **Submit for review** ở bản app thật và làm theo yêu cầu của TikTok.

## 3. Nhập khoá vào trình dựng

1. Mở trình dựng: `npm run editor`, sau đó vào <http://localhost:3100>.
2. Bấm **📤 TikTok** trên thanh trên cùng.
3. Dán **Client Key** và **Client Secret**, rồi bấm **Lưu khoá**.
4. Bấm **Kết nối tài khoản TikTok**. Một cửa sổ TikTok hiện ra, bạn đăng nhập và đồng ý cấp quyền.

Khoá và phiên đăng nhập chỉ được lưu trên máy bạn, trong thư mục `.tiktok/`. Thư mục này đã được loại khỏi git.

Phiên đăng nhập tự gia hạn và dùng được 180 ngày. Hết hạn thì bấm kết nối lại.

## 4. Gửi video

1. Xuất video của dự án (nút **Xuất video**). Nên dùng khung **9:16**.
2. Bấm **📤 TikTok**, chọn một tiêu đề gợi ý và sửa nếu muốn.
3. Bấm **Gửi bản nháp lên TikTok**. Tiêu đề kèm hashtag được tự sao chép vào bộ nhớ tạm.
4. Trên điện thoại, mở TikTok → **Hộp thư** → thông báo bản nháp → dán tiêu đề → **Đăng**.

## Giới hạn của TikTok

- Tối đa **5 bản nháp đang chờ** trong 24 giờ.
- Tối đa 6 lần tải lên mỗi phút.
- Kiểu gửi bản nháp không cho app tự điền tiêu đề. Vì vậy trình dựng sao chép sẵn để bạn dán.
- File tối đa 4 GB. TikTok còn giới hạn độ dài video theo từng tài khoản.

## 5. Lịch gửi bản nháp mỗi ngày

Trình dựng có thể tự gửi mỗi ngày một clip vào hộp thư TikTok, đúng giờ bạn chọn.

1. Xuất video cho từng dự án clip.
2. Bấm **📤 TikTok** → mục **5. Lịch gửi bản nháp mỗi ngày** → **Thêm dự án này vào hàng chờ**. Làm lần lượt cho từng clip, rồi dùng nút ↑ ↓ để xếp thứ tự.
3. Chọn giờ, rồi tích **Bật gửi tự động mỗi ngày lúc**.
4. Đến giờ, TikTok báo có bản nháp mới trên điện thoại. Bạn gắn chú thích rồi bấm **Đăng**. Nút 📋 sao chép chú thích gợi ý của từng clip.

Lưu ý:

- Trình dựng (`npm run editor`) phải đang chạy vào giờ gửi. Nếu lúc đó máy tắt, clip sẽ được gửi ngay khi bạn mở lại trình dựng trong cùng ngày.
- Mỗi ngày gửi tối đa 1 clip. Nếu bật lịch sau giờ đã chọn trong ngày, lịch sẽ bắt đầu từ ngày hôm sau.
- Nếu gửi lỗi, trình dựng tự thử lại sau 10 phút, tối đa 3 lần. Sau đó clip được đánh dấu **Lỗi** để bạn bấm **Thử lại**.
- Lịch được lưu trong `.tiktok/schedule.json`.

Clip dọc của tập 1 được tạo bằng `python scripts/make_vertical_clip.py`, kèm chú thích gợi ý trong `out/tap-1-doc-captions.json`.

## 6. Tự đăng thẳng (Direct Post)

Nếu không muốn mở app TikTok trên điện thoại, trình dựng có thể đăng thẳng video lên trang cá nhân, kèm luôn tiêu đề.

1. Trong trang app TikTok (Sandbox) → **Content Posting API**, bật **Direct Post**.
2. Ở **Scopes**, thêm `video.publish`, rồi lưu lại.
3. Trong trình dựng, bấm **📤 TikTok** → mục **4. Cách đăng** → chọn **Tự đăng** → bấm **Tôi đã bật Direct Post** → bấm **Kết nối lại tài khoản TikTok**.
4. Chọn **Ai được xem**, bật hoặc tắt bình luận / Duet / Stitch, rồi bấm **Đăng lên TikTok**.

Giới hạn khi app **chưa được TikTok duyệt**:

- Chỉ đăng được ở chế độ **Chỉ mình tôi**.
- Lúc đăng, tài khoản TikTok phải đang để **riêng tư**: Cài đặt → Quyền riêng tư → Tài khoản riêng tư.
- Muốn công khai: sau khi đăng, chuyển tài khoản về công khai, rồi mở video trong TikTok Studio và đổi "Ai có thể xem" thành **Mọi người**.
- Muốn đăng công khai thẳng, bạn cần gửi app cho TikTok xét duyệt (**Submit for review**).
