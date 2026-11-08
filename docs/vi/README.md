# Claude Queue Manager (QM) — Hướng dẫn sử dụng

[🌐 Vietnamese / Tiếng Việt](../languages/README.md) · [GitHub](https://github.com/ByBrawe/Claude-Queue-Manager) · [MIT](../../LICENSE)

QM đưa các tác vụ vào hàng đợi trong tab **Code** của Claude Desktop hoặc Claude Code CLI. Mỗi tác vụ chạy ở một lượt riêng sau khi lượt trước kết thúc, không làm đổi hướng công việc đang chạy.

## “tiếp tục”

`tiếp tục` là nội dung tác vụ bình thường, không phải lệnh đặc biệt. Các từ khóa `/qm` vẫn bằng tiếng Anh, nhưng nội dung tác vụ có thể viết bằng bất kỳ ngôn ngữ nào.

```text
/qm repeat 5 tiếp tục
```

## Cài đặt

Cài marketplace và plugin bằng các lệnh bên dưới. Sau đó mở phiên **Code** cục bộ mới hoặc dùng `/reload-plugins`. Tab Chat thông thường không được hỗ trợ.

```text
/plugin marketplace add ByBrawe/Claude-Queue-Manager
/plugin install qm@claude-queue-manager
```

## Bắt đầu an toàn

Tạm dừng hàng đợi, thêm tác vụ, kiểm tra thứ tự qua `/qm`, rồi tiếp tục.

```text
/qm pause
/qm batch Sửa các bài kiểm thử lỗi || Chạy bản dựng || Tóm tắt thay đổi
/qm
/qm resume
```

## Danh sách lệnh

| /qm | Danh sách lệnh |
| --- | --- |
| `/qm` | Mở bảng quản lý hàng đợi |
| `/qm add tiếp tục` | Thêm một tác vụ |
| `/qm repeat 5 tiếp tục` | Lặp lại tác vụ 1–200 lần |
| `/qm batch A \|\| B \|\| C` | Thêm nhiều tác vụ theo thứ tự |
| `/qm front tiếp tục` | Đưa tác vụ lên đầu |
| `/qm pause  /qm resume` | Tạm dừng / tiếp tục |
| `/qm mv 3 1` | Chuyển tác vụ chờ số 3 lên vị trí 1 |
| `/qm edit 2 tiếp tục` | Sửa tác vụ chờ số 2 |
| `/qm rm 2` | Xóa tác vụ chờ số 2 |
| `/qm undo` | Hoàn tác thay đổi gần nhất |
| `/qm clear` | Chỉ xóa tác vụ đang chờ |
| `/qm recover` | Khôi phục tác vụ sau sự cố rồi tạm dừng |
| `/qm help` | Hiển thị trợ giúp |

## Giới hạn và lưu ý

Tối đa **200 tác vụ mỗi lần thêm** và **500 tác vụ chờ**. Mỗi tác vụ có thể tốn hạn mức mô hình và ngữ cảnh; mỗi lượt mới không tự xóa ngữ cảnh 200K. Đừng lặp 'tiếp tục' nhiều lần nếu không có điều kiện dừng rõ ràng. Có phản hồi không đồng nghĩa với hoàn thành thành công.

## Xử lý sự cố

Nếu không thấy `/qm`, hãy kiểm tra plugin và mở phiên **Code** cục bộ mới. Tắt các plugin hàng đợi khác và thử trước với hai tác vụ ngắn.

### ZIP

Giải nén ZIP, giữ thư mục `Claude-Queue-Manager` ở một vị trí cố định rồi chạy:

```sh
claude plugin marketplace add /absolute/path/to/Claude-Queue-Manager
claude plugin install qm@claude-queue-manager
```

> Lưu ý: hướng dẫn này đã được dịch, nhưng giao diện bảng QM vẫn bằng tiếng Anh.
